import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { db as defaultDb } from "@/db";
import {
  ingestBounceEvent,
  ingestInboundEmail,
} from "@/lib/domain/inbound-email";
import { htmlToText } from "@/lib/providers/fetcher/safe";
import { hasValidBrowserOrigin } from "@/lib/http/origin";
import { getRuntimeQueue } from "@/lib/jobs/runtime";
import type { JobQueue } from "@/lib/jobs/types";

const maxBodyBytes = 1_000_000;

type ResendWebhookDependencies = {
  apiBase?: string;
  apiKey?: string;
  db?: typeof defaultDb;
  fetch?: typeof globalThis.fetch;
  queue?: JobQueue;
  secret?: string;
};

export async function handleResendWebhook(
  request: Request,
  dependencies: ResendWebhookDependencies = {},
) {
  if (!hasValidBrowserOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  if (Number(request.headers.get("content-length") ?? 0) > maxBodyBytes) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  const rawBody = await request.text().catch(() => null);
  if (rawBody === null) {
    return NextResponse.json({ error: "Malformed webhook body." }, { status: 400 });
  }
  if (Buffer.byteLength(rawBody, "utf8") > maxBodyBytes) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  const secret =
    dependencies.secret ?? process.env.RESEND_WEBHOOK_SECRET ?? "";
  const signatureHeaders = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };
  if (!secret) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 },
    );
  }
  try {
    new Webhook(secret).verify(rawBody, signatureHeaders);
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 },
    );
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Malformed webhook payload." },
      { status: 400 },
    );
  }
  if (!isRecord(event) || typeof event.type !== "string") {
    return NextResponse.json(
      { error: "Malformed webhook payload." },
      { status: 400 },
    );
  }
  if (event.type !== "email.received" && event.type !== "email.bounced") {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!isRecord(event.data)) {
    return NextResponse.json(
      { error: "Malformed webhook payload." },
      { status: 400 },
    );
  }

  const database = dependencies.db ?? defaultDb;
  if (event.type === "email.received") {
    return receiveEmail(event.data, dependencies, database);
  }
  return receiveBounce(
    event.data,
    rawBody,
    signatureHeaders["svix-id"],
    database,
  );
}

async function receiveEmail(
  data: Record<string, unknown>,
  dependencies: ResendWebhookDependencies,
  database: typeof defaultDb,
) {
  const emailId = stringValue(data.email_id);
  const from = stringValue(data.from);
  const recipients = stringArray(data.to);
  const receivedFor = stringArray(data.received_for);
  const to =
    [...recipients, ...receivedFor].find((address) =>
      /reply\+[a-z0-9-]+@/i.test(address),
    ) ?? recipients[0];
  if (!emailId || !from || !to) {
    return NextResponse.json(
      { error: "Missing inbound email fields." },
      { status: 400 },
    );
  }

  const apiKey = dependencies.apiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Unable to retrieve inbound email." },
      { status: 502 },
    );
  }
  const apiBase =
    dependencies.apiBase ??
    process.env.RESEND_API_BASE ??
    "https://api.resend.com";
  let body: unknown;
  try {
    const response = await (dependencies.fetch ?? globalThis.fetch)(
      `${apiBase.replace(/\/$/, "")}/emails/receiving/${encodeURIComponent(emailId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to retrieve inbound email." },
        { status: 502 },
      );
    }
    body = await response.json();
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve inbound email." },
      { status: 502 },
    );
  }
  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Unable to retrieve inbound email." },
      { status: 502 },
    );
  }

  const emailHeaders = isRecord(body.headers) ? body.headers : {};
  const content =
    typeof body.text === "string"
      ? body.text
      : htmlToText(stringValue(body.html) ?? "");
  const queue = dependencies.queue ?? (await getRuntimeQueue());
  try {
    const result = await ingestInboundEmail(
      { type: "system" },
      {
        provider: "resend",
        eventId: emailId,
        from: stringValue(body.from) ?? from,
        to,
        subject: stringValue(body.subject) ?? stringValue(data.subject) ?? "",
        text: stripQuotedReply(content),
        messageId:
          stringValue(body.message_id) ?? stringValue(data.message_id),
        inReplyTo: stringValue(emailHeaders["in-reply-to"]),
        references: stringValue(emailHeaders.references),
        receivedAt: new Date(),
      },
      queue,
      database,
    );
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch {
    return NextResponse.json(
      { error: "Unable to process inbound email." },
      { status: 500 },
    );
  }
}

async function receiveBounce(
  data: Record<string, unknown>,
  rawBody: string,
  svixId: string,
  database: typeof defaultDb,
) {
  const emailId = stringValue(data.email_id);
  const recipient = stringArray(data.to)[0];
  if (!svixId || !emailId || !recipient) {
    return NextResponse.json(
      { error: "Missing bounce event fields." },
      { status: 400 },
    );
  }
  const bounce = isRecord(data.bounce) ? data.bounce : {};
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  try {
    const result = await ingestBounceEvent(
      { type: "system" },
      {
        provider: "resend",
        eventId: svixId,
        recipient,
        messageId: emailId,
        permanent: bounce.type === "Permanent",
        payloadHash,
      },
      database,
    );
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch {
    return NextResponse.json(
      { error: "Unable to process bounce event." },
      { status: 500 },
    );
  }
}

export function stripQuotedReply(text: string) {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (
      /^\s*On .+ wrote:\s*$/i.test(line) ||
      /^\s*-{5,}\s*Original Message\s*-{5,}\s*$/i.test(line) ||
      (/^\s*From:\s*.+$/i.test(line) &&
        index > 0 &&
        lines[index - 1]!.trim() === "")
    ) {
      break;
    }
    if (/^\s*>/.test(line)) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
