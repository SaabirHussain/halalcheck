import { createHash } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  outreachMessages,
  outreachThreads,
  sources,
  suppressions,
  unexpectedReplies,
  webhookEvents,
} from "@/db/schema";
import type { JobQueue } from "@/lib/jobs/types";
import type { Actor } from "./actor";
import { writeAudit } from "./audit";
import { requireAdminActor } from "./actor";

export type InboundEmail = {
  provider: string;
  eventId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  receivedAt: Date;
};

export async function ingestInboundEmail(
  actor: Actor,
  input: InboundEmail,
  queue: JobQueue,
  database: typeof defaultDb = defaultDb,
) {
  if (actor.type === "admin") await requireAdminActor(actor, database);
  if (
    actor.type !== "system" &&
    actor.type !== "worker" &&
    actor.type !== "admin"
  ) {
    throw new Error("Inbound email ingestion requires a trusted actor.");
  }
  const payloadHash = createHash("sha256")
    .update(
      [input.provider, input.from, input.to, input.subject, input.text].join(
        "\0",
      ),
    )
    .digest("hex");
  const result = await database.transaction(async (tx) => {
    const [event] = await tx
      .insert(webhookEvents)
      .values({ provider: input.provider, eventId: input.eventId, payloadHash })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    if (!event) {
      const [existing] = await tx
        .select({
          id: outreachMessages.id,
          threadId: outreachMessages.threadId,
        })
        .from(outreachMessages)
        .where(
          eq(
            outreachMessages.idempotencyKey,
            `inbound:${input.provider}:${input.eventId}`,
          ),
        )
        .limit(1);
      return {
        duplicate: true,
        matched: Boolean(existing),
        messageId: existing?.id ?? null,
      };
    }

    const token = input.to.match(/reply\+([a-z0-9-]+)@/i)?.[1];
    let thread: typeof outreachThreads.$inferSelect | undefined;
    if (token) {
      [thread] = await tx
        .select()
        .from(outreachThreads)
        .where(eq(outreachThreads.threadToken, token))
        .for("update")
        .limit(1);
    }
    if (!thread) {
      const refs = [
        input.inReplyTo,
        ...(input.references ?? "").split(/\s+/),
      ].filter((value): value is string => Boolean(value));
      if (refs.length) {
        const [outbound] = await tx
          .select({ threadId: outreachMessages.threadId })
          .from(outreachMessages)
          .where(
            or(
              ...refs.map((reference) =>
                eq(outreachMessages.messageIdHeader, reference),
              ),
            ),
          )
          .limit(1);
        if (outbound) {
          [thread] = await tx
            .select()
            .from(outreachThreads)
            .where(eq(outreachThreads.id, outbound.threadId))
            .for("update")
            .limit(1);
        }
      }
    }
    if (!thread) {
      await tx.insert(unexpectedReplies).values({
        provider: input.provider,
        fromAddress: input.from,
        toAddress: input.to,
        subject: input.subject,
        bodyText: input.text,
        receivedAt: input.receivedAt,
        reviewStatus: "unmatched",
      });
      await tx
        .update(webhookEvents)
        .set({ processedAt: new Date() })
        .where(eq(webhookEvents.id, event.id));
      await writeAudit(tx, {
        actorType: "system",
        action: "unexpected_reply_received",
        entityType: "webhook_event",
        entityId: event.id,
      });
      return { duplicate: false, matched: false, messageId: null };
    }

    const [previous] = await tx
      .select({ sequence: outreachMessages.sequence })
      .from(outreachMessages)
      .where(
        and(
          eq(outreachMessages.threadId, thread.id),
          eq(outreachMessages.direction, "inbound"),
        ),
      )
      .orderBy(desc(outreachMessages.sequence))
      .limit(1);
    const sequence = (previous?.sequence ?? 0) + 1;
    const [message] = await tx
      .insert(outreachMessages)
      .values({
        threadId: thread.id,
        direction: "inbound",
        sequence,
        kind: "reply",
        status: "received",
        subject: input.subject.slice(0, 998),
        bodyText: input.text.slice(0, 100_000),
        questions: [],
        messageIdHeader: input.messageId ?? null,
        inReplyTo: input.inReplyTo ?? null,
        receivedAt: input.receivedAt,
        idempotencyKey: `inbound:${input.provider}:${input.eventId}`,
        providerMessageId: input.eventId,
      })
      .onConflictDoNothing()
      .returning({ id: outreachMessages.id });
    if (!message) {
      await tx
        .update(webhookEvents)
        .set({ processedAt: new Date() })
        .where(eq(webhookEvents.id, event.id));
      return { duplicate: true, matched: true, messageId: null };
    }
    await tx
      .insert(sources)
      .values({
        investigationId: thread.investigationId,
        branchId: thread.branchId,
        kind: "email_reply",
        title: `Business reply received ${input.receivedAt.toISOString()}`,
        retrievedAt: input.receivedAt,
        rawText: input.text,
        isPublic: false,
        messageId: message.id,
        idempotencyKey: `inbound:${input.provider}:${input.eventId}`,
      })
      .onConflictDoNothing();
    await tx
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, event.id));
    await writeAudit(tx, {
      actorType: "system",
      action: "inbound_reply_ingested",
      entityType: "outreach_message",
      entityId: message.id,
      metadata: {
        provider: input.provider,
        investigationId: thread.investigationId,
      },
    });
    return { duplicate: false, matched: true, messageId: message.id };
  });
  if (result.matched && result.messageId) {
    await queue.enqueue(
      "message.parse",
      { messageId: result.messageId },
      { singletonKey: `message_parse:${result.messageId}` },
    );
  }
  return result;
}

export async function ingestBounceEvent(
  actor: Actor,
  input: {
    provider: string;
    eventId: string;
    recipient: string;
    messageId: string;
    permanent: boolean;
    payloadHash?: string;
  },
  database: typeof defaultDb = defaultDb,
) {
  if (actor.type !== "system" && actor.type !== "worker")
    throw new Error("Worker access required.");
  const payloadHash =
    input.payloadHash ??
    createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const [event] = await database
    .insert(webhookEvents)
    .values({
      provider: input.provider,
      eventId: input.eventId,
      payloadHash,
      processedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (!event) return { duplicate: true };
  if (!input.permanent) return { duplicate: false, suppressed: false };
  const [message] = await database
    .select({ id: outreachMessages.id, threadId: outreachMessages.threadId })
    .from(outreachMessages)
    .where(
      or(
        eq(outreachMessages.providerMessageId, input.messageId),
        eq(outreachMessages.messageIdHeader, input.messageId),
      ),
    )
    .limit(1);
  if (!message) return { duplicate: false, suppressed: false };
  const [thread] = await database
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.id, message.threadId))
    .limit(1);
  await database.transaction(async (tx) => {
    await tx
      .update(outreachMessages)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(outreachMessages.id, message.id));
    if (thread)
      await tx
        .update(outreachThreads)
        .set({ status: "bounced", updatedAt: new Date() })
        .where(eq(outreachThreads.id, thread.id));
    await tx
      .insert(suppressions)
      .values({
        valueNormalized: input.recipient.trim().toLowerCase(),
        kind: "email",
        reason: "bounce",
      })
      .onConflictDoNothing();
    await writeAudit(tx, {
      actorType: "system",
      action: "outreach_bounce_received",
      entityType: "outreach_message",
      entityId: message.id,
    });
  });
  return { duplicate: false, suppressed: true };
}
