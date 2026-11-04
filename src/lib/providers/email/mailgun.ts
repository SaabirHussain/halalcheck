import type { EmailMessage, EmailProvider } from "./types";

export class MailgunEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly domain: string,
    private readonly apiBase = "https://api.mailgun.net/v3",
  ) {}

  async send(message: EmailMessage) {
    if (
      process.env.EMAIL_PROVIDER !== "mailgun" ||
      process.env.OUTREACH_ALLOW_REAL_SEND !== "true"
    ) {
      throw new Error("Mailgun delivery is disabled; explicit real-send flag required.");
    }
    const form = new FormData();
    form.set("from", message.from);
    form.set("to", message.to);
    form.set("subject", message.subject);
    form.set("text", message.bodyText);
    for (const [name, value] of Object.entries(message.headers)) {
      form.append(`h:${name}`, value);
    }
    const response = await fetch(
      `${this.apiBase.replace(/\/$/, "")}/${encodeURIComponent(this.domain)}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`api:${this.apiKey}`).toString("base64")}` },
        body: form,
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) throw new Error(`Mailgun send failed with status ${response.status}.`);
    const data = (await response.json()) as { id?: string };
    return { providerMessageId: data.id ?? "mailgun:unknown", captured: false };
  }
}

export function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string,
  signingKey: string,
  now = Date.now(),
) {
  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp) || !token || !signature || !signingKey) return false;
  if (Math.abs(now - parsedTimestamp * 1000) > 15 * 60 * 1000) return false;
  const expected = createHmac("sha256", signingKey).update(`${timestamp}${token}`).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

import { createHmac, timingSafeEqual } from "node:crypto";
