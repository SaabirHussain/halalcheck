import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ingestInboundEmail } from "@/lib/domain/inbound-email";
import { db } from "@/db";
import { hasValidBrowserOrigin } from "@/lib/http/origin";
import { getRuntimeQueue } from "@/lib/jobs/runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasValidBrowserOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected a form-encoded webhook." }, { status: 400 });
  const signature = readSignature(form);
  if (!verifyMailgun(signature.timestamp, signature.token, signature.signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const headerValues = readMessageHeaders(form.get("message-headers"));
  const messageId =
    stringValue(form.get("Message-Id")) ??
    headerValues["message-id"] ??
    signature.token;
  const from = stringValue(form.get("sender")) ?? stringValue(form.get("from"));
  const to = stringValue(form.get("recipient")) ?? stringValue(form.get("To"));
  const text =
    stringValue(form.get("stripped-text")) ??
    stringValue(form.get("body-plain")) ??
    stringValue(form.get("body")) ??
    "";
  if (!from || !to || !text) {
    return NextResponse.json({ error: "Missing inbound email fields." }, { status: 400 });
  }
  try {
    const queue = await getRuntimeQueue();
    const result = await ingestInboundEmail(
      { type: "system" },
      {
        provider: "mailgun",
        eventId: messageId,
        from,
        to,
        subject: stringValue(form.get("subject")) ?? "",
        text,
        messageId,
        inReplyTo: headerValues["in-reply-to"],
        references: headerValues.references ?? null,
        receivedAt: new Date(),
      },
      queue,
      db,
    );
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch {
    return NextResponse.json({ error: "Unable to process inbound email." }, { status: 400 });
  }
}

function readSignature(form: FormData) {
  const nestedTimestamp = stringValue(form.get("signature[timestamp]"));
  const nestedToken = stringValue(form.get("signature[token]"));
  const nestedSignature = stringValue(form.get("signature[signature]"));
  const signatureField = stringValue(form.get("signature"));
  if (signatureField && !nestedSignature) {
    try {
      const object = JSON.parse(signatureField) as Record<string, unknown>;
      return {
        timestamp: stringValue(object.timestamp),
        token: stringValue(object.token),
        signature: stringValue(object.signature),
      };
    } catch {
      return { timestamp: null, token: null, signature: null };
    }
  }
  return {
    timestamp: nestedTimestamp ?? stringValue(form.get("timestamp")),
    token: nestedToken ?? stringValue(form.get("token")),
    signature: nestedSignature ?? stringValue(form.get("signature-value")),
  };
}

function verifyMailgun(timestamp: string | null, token: string | null, signature: string | null) {
  const secret = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!secret || !timestamp || !token || !signature || !/^\d{10,13}$/.test(timestamp)) return false;
  const timestampMs = Number(timestamp) * (timestamp.length === 10 ? 1000 : 1);
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}${token}`).digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const signatureBytes = Buffer.from(signature, "hex");
  return expectedBytes.length === signatureBytes.length && timingSafeEqual(expectedBytes, signatureBytes);
}

function readMessageHeaders(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return {};
  try {
    const headers = JSON.parse(value) as Array<[string, string]>;
    return Object.fromEntries(headers.map(([key, val]) => [key.toLowerCase(), val]));
  } catch {
    return {};
  }
}

function stringValue(value: FormDataEntryValue | unknown) {
  return typeof value === "string" && value.length ? value : null;
}
