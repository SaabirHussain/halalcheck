import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingestBounceEvent } from "@/lib/domain/inbound-email";
import { hasValidBrowserOrigin } from "@/lib/http/origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasValidBrowserOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  if (!form)
    return NextResponse.json(
      { error: "Expected a form-encoded webhook." },
      { status: 400 },
    );
  const timestamp =
    stringValue(form.get("signature[timestamp]")) ??
    stringValue(form.get("timestamp"));
  const token =
    stringValue(form.get("signature[token]")) ?? stringValue(form.get("token"));
  const signature =
    stringValue(form.get("signature[signature]")) ??
    stringValue(form.get("signature-value"));
  if (!verifyMailgun(timestamp, token, signature)) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 },
    );
  }
  const eventDataRaw = stringValue(form.get("event-data"));
  let eventData: Record<string, unknown>;
  try {
    eventData = eventDataRaw
      ? (JSON.parse(eventDataRaw) as Record<string, unknown>)
      : Object.fromEntries(form.entries());
  } catch {
    return NextResponse.json(
      { error: "Malformed event payload." },
      { status: 400 },
    );
  }
  const eventId = stringValue(eventData.id) ?? `${timestamp}:${token}`;
  const eventType =
    stringValue(eventData.event) ??
    stringValue(eventData["event-type"]) ??
    "unknown";
  const message = eventData.message as Record<string, unknown> | undefined;
  const headers = message?.headers as Record<string, unknown> | undefined;
  const messageId =
    stringValue(headers?.["message-id"]) ??
    stringValue(eventData["message-id"]);
  const recipient =
    stringValue(eventData.recipient) ??
    stringValue(
      (eventData as { envelope?: { targets?: string } }).envelope?.targets,
    );
  if (!messageId || !recipient)
    return NextResponse.json(
      { error: "Missing message identifier or recipient." },
      { status: 400 },
    );
  const deliveryStatus = eventData["delivery-status"] as
    Record<string, unknown> | undefined;
  const permanent =
    /^(permanent_fail|bounced)$/i.test(eventType) ||
    (/^failed$/i.test(eventType) &&
      (stringValue(deliveryStatus?.severity) === "permanent" ||
        (stringValue(deliveryStatus?.code)?.startsWith("5") ?? false)));
  const payloadHash = createHash("sha256")
    .update(JSON.stringify({ eventId, eventType, messageId, recipient }))
    .digest("hex");
  try {
    const result = await ingestBounceEvent(
      { type: "system" },
      {
        provider: "mailgun",
        eventId,
        recipient,
        messageId,
        permanent,
        payloadHash,
      },
      db,
    );
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch {
    return NextResponse.json(
      { error: "Unable to process event." },
      { status: 400 },
    );
  }
}

function verifyMailgun(
  timestamp: string | null,
  token: string | null,
  signature: string | null,
) {
  const secret = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (
    !secret ||
    !timestamp ||
    !token ||
    !signature ||
    !/^\d{10,13}$/.test(timestamp)
  )
    return false;
  const milliseconds = Number(timestamp) * (timestamp.length === 10 ? 1000 : 1);
  if (Math.abs(Date.now() - milliseconds) > 5 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}${token}`)
    .digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const suppliedBytes = Buffer.from(signature, "hex");
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
