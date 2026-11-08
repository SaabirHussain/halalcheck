import { promises as dns } from "node:dns";
import type { LookupAddress, LookupOptions } from "node:dns";
import { isIP } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Agent, fetch as undiciFetch } from "undici";
import type { Response as UndiciResponse } from "undici";
import type { FetchedPage, SafeFetcher } from "./types";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 20_000;

function ipv4ToNumber(ip: string) {
  return ip.split(".").reduce((total, part) => total * 256 + Number(part), 0);
}

function inV4Range(ip: string, base: string, bits: number) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToNumber(ip) & mask) === (ipv4ToNumber(base) & mask);
}

function isUnsafeIPv4(ip: string) {
  return [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ].some(([base, bits]) => inV4Range(ip, base as string, bits as number));
}

function ipv6ToWords(ip: string) {
  const mapped = ip.toLowerCase().replace(/%.+$/, "");
  if (mapped.includes(".")) {
    const ipv4 = mapped.slice(mapped.lastIndexOf(":") + 1);
    const number = ipv4ToNumber(ipv4);
    return [
      ...mapped.slice(0, mapped.lastIndexOf(":")).split(":").filter(Boolean),
      ((number >>> 16) & 0xffff).toString(16),
      (number & 0xffff).toString(16),
    ].map((word) => parseInt(word, 16));
  }
  const [leftRaw, rightRaw = ""] = mapped.split("::");
  const left = leftRaw
    ? leftRaw.split(":").map((part) => parseInt(part || "0", 16))
    : [];
  const right = rightRaw
    ? rightRaw.split(":").map((part) => parseInt(part || "0", 16))
    : [];
  const middle = Array(Math.max(0, 8 - left.length - right.length)).fill(
    0,
  ) as number[];
  return [...left, ...middle, ...right];
}

export function isPublicIp(address: string) {
  const version = isIP(address);
  if (version === 4) return !isUnsafeIPv4(address);
  if (version !== 6) return false;
  const words = ipv6ToWords(address);
  const mappedV4 =
    words.slice(0, 5).every((part) => part === 0) && words[5] === 0xffff;
  if (mappedV4) {
    const ipv4 = `${words[6]! >>> 8}.${words[6]! & 255}.${words[7]! >>> 8}.${words[7]! & 255}`;
    return !isUnsafeIPv4(ipv4);
  }
  const globalUnicast = (words[0]! & 0xe000) === 0x2000;
  const documentation = words[0] === 0x2001 && words[1] === 0x0db8;
  return globalUnicast && !documentation;
}

function domainAllowed(hostname: string, allowedDomains: string[]) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  const withoutWww = (domain: string) => domain.replace(/^www\./, "");
  return allowedDomains.some((domain) => {
    const allowed = domain
      .toLowerCase()
      .replace(/^\*\./, "")
      .replace(/\.$/, "");
    return (
      normalized === allowed ||
      normalized.endsWith(`.${allowed}`) ||
      normalized === withoutWww(allowed) ||
      withoutWww(normalized) === allowed
    );
  });
}

export function validateFetchUrl(urlText: string, allowedDomains: string[]) {
  const url = new URL(urlText);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Only HTTP(S) URLs are allowed.");
  if (url.username || url.password)
    throw new Error("URL credentials are not allowed.");
  if (url.port && !["80", "443"].includes(url.port))
    throw new Error("Nonstandard ports are blocked.");
  if (isIP(url.hostname) && !isPublicIp(url.hostname))
    throw new Error("Private network addresses are blocked.");
  if (!domainAllowed(url.hostname, allowedDomains))
    throw new Error("Host is not allowlisted.");
  return url;
}

async function readCapped(response: UndiciResponse) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Fetched content exceeds the 2 MB limit.");
    }
    parts.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function htmlToText(html: string) {
  const structuredAddresses = extractStructuredAddresses(html);
  const text = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  return structuredAddresses.length
    ? `${text}\n${structuredAddresses.map((value) => `Address: ${value}`).join("\n")}`
    : text;
}

function extractStructuredAddresses(html: string) {
  const addresses: string[] = [];
  const seen = new Set<string>();
  const fieldPattern =
    /\\?"\s*(streetAddress|addressLocality|postalCode|address)\s*\\?"\s*:\s*\\?"((?:\\[^"]|[^"\\])*)\\?"/gi;
  for (const scriptMatch of html.matchAll(
    /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi,
  )) {
    const script = scriptMatch[1] ?? "";
    fieldPattern.lastIndex = 0;
    for (const fieldMatch of script.matchAll(fieldPattern)) {
      const field = fieldMatch[1]!.trim().toLowerCase();
      const value = fieldMatch[2]!
        .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) =>
          String.fromCharCode(Number.parseInt(hex, 16)),
        )
        .replace(/\\(["\\])/g, "$1")
        .replace(/\\\//g, "/")
        .replace(/\s+/g, " ")
        .trim();
      const validValue =
        value.length >= 5 &&
        value.length <= 200 &&
        (field === "addresslocality"
          ? /\p{L}/u.test(value) &&
            !/\p{N}/u.test(value) &&
            /^[\p{L}\p{M} .’'-]+$/u.test(value)
          : /\p{L}/u.test(value) && /\p{N}/u.test(value));
      if (!validValue) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      addresses.push(value);
      if (addresses.length === 100) return addresses;
    }
  }
  return addresses;
}

async function demoFixture(url: URL): Promise<FetchedPage> {
  const pathname = path.posix.normalize(url.pathname).replace(/^\/+/, "");
  if (pathname.includes("..")) throw new Error("Invalid demo fixture path.");
  const fixturePath =
    url.pathname === "/" || url.pathname.endsWith("/")
      ? `${url.pathname}index.html`
      : url.pathname;
  const filename = path.join(
    process.cwd(),
    "src/demo/sites",
    `${url.hostname}${fixturePath}`,
  );
  const bytes = await readFile(filename);
  const html = bytes.toString("utf8");
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1] ?? url.hostname;
  return {
    url: url.toString(),
    contentType: "text/html",
    title,
    text: htmlToText(html),
    bytes,
    isPdf: false,
  };
}

async function resolvePublic(hostname: string) {
  if (isIP(hostname)) {
    if (!isPublicIp(hostname))
      throw new Error("Private or special-use IP is blocked.");
    return hostname;
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (
    !records.length ||
    records.some((record) => !isPublicIp(record.address))
  ) {
    throw new Error("Hostname resolves to a private or special-use IP.");
  }
  return records[0]!.address;
}

export function pinnedLookup(ip: string) {
  const family = isIP(ip);
  return (
    _hostname: string,
    options: LookupOptions,
    callback: (
      error: NodeJS.ErrnoException | null,
      address: string | LookupAddress[],
      family?: number,
    ) => void,
  ) => {
    if (options.all) callback(null, [{ address: ip, family }]);
    else callback(null, ip, family);
  };
}

export class SSRFSafeFetcher implements SafeFetcher {
  constructor(
    private readonly fetchImpl: typeof undiciFetch = undiciFetch,
    private readonly resolveHost: typeof resolvePublic = resolvePublic,
  ) {}

  async fetch(urlText: string, allowedDomains: string[]): Promise<FetchedPage> {
    let url = validateFetchUrl(urlText, allowedDomains);
    if (url.hostname.endsWith(".demo.halalcheck.test")) return demoFixture(url);
    let response: UndiciResponse | undefined;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const validated = validateFetchUrl(url.toString(), allowedDomains);
      const ip = await this.resolveHost(validated.hostname);
      const dispatcher = new Agent({
        connect: {
          lookup: pinnedLookup(ip),
        },
      });
      try {
        response = await this.fetchImpl(validated, {
          dispatcher,
          redirect: "manual",
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: {
            "User-Agent": "HalalCheck research bot (community directory)",
          },
        });
      } finally {
        await dispatcher.close();
      }
      if (response && [301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects === MAX_REDIRECTS) throw new Error("Too many redirects.");
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirect omitted location.");
        url = new URL(location, validated);
        continue;
      }
      break;
    }
    if (!response?.ok)
      throw new Error(`Fetcher returned status ${response?.status ?? 0}.`);
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    if (!["text/html", "text/plain", "application/pdf"].includes(contentType)) {
      throw new Error("Unsupported fetched content type.");
    }
    const bytes = await readCapped(response);
    const isPdf = contentType === "application/pdf";
    const raw = Buffer.from(bytes).toString("utf8");
    const title =
      raw.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() ?? url.hostname;
    return {
      url: url.toString(),
      contentType,
      title,
      text: isPdf || contentType === "text/plain" ? raw : htmlToText(raw),
      bytes,
      isPdf,
    };
  }
}
