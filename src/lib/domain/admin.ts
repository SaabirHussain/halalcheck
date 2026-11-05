import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb } from "@/db";
import {
  branches,
  businesses,
  certificates,
  claims,
  contactEndpoints,
  corrections,
  investigations,
  outreachMessages,
  outreachThreads,
  sources,
  suppressions,
  unexpectedReplies,
} from "@/db/schema";
import type { JobQueue } from "@/lib/jobs/types";
import { redactPublicExcerpt } from "./public";
import type { Actor } from "./actor";
import { requireAdminActor } from "./actor";
import { writeAudit } from "./audit";
import { ingestInboundEmail } from "./inbound-email";

type Database = typeof defaultDb;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const providerBusinessDetailsSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  city: z.string().trim().min(1).max(200),
  website: z
    .string()
    .trim()
    .pipe(
      z.union([
        z
          .string()
          .url()
          .refine((value) => /^https?:\/\//i.test(value)),
        z.literal(""),
      ]),
    )
    .default(""),
  phone: z.string().trim().max(100).default(""),
  timezone: z.string().trim().min(1).max(100).default("America/Toronto"),
});

export const waitingForBusinessDetails =
  "Waiting for an administrator to confirm business details before contacting the business.";
export const waitingForAutomaticBusinessDetails =
  "Couldn't confirm business details from the restaurant's website automatically. Waiting for an administrator to confirm them.";

export async function applyFirstPartyBusinessDetails(
  tx: Transaction,
  details: {
    branchId: string;
    name: string;
    address: string;
    city: string;
    website: string | null;
    phone: string | null;
    timezone: string;
  },
  auditActor: {
    actorType: "admin" | "worker" | "system";
    actorUserId?: string | null;
    action: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
) {
  const [branch] = await tx
    .select({ businessId: branches.businessId })
    .from(branches)
    .where(eq(branches.id, details.branchId))
    .for("update")
    .limit(1);
  if (!branch) throw new Error("Branch not found.");
  const now = new Date();
  await tx
    .update(businesses)
    .set({ name: details.name, website: details.website, updatedAt: now })
    .where(eq(businesses.id, branch.businessId));
  await tx
    .update(branches)
    .set({
      name: details.name,
      address: details.address,
      city: details.city,
      website: details.website,
      phone: details.phone,
      timezone: details.timezone,
      detailsSource: "first_party",
      updatedAt: now,
    })
    .where(eq(branches.id, details.branchId));
  await writeAudit(tx, {
    actorUserId: auditActor.actorUserId,
    actorType: auditActor.actorType,
    action: auditActor.action,
    entityType: "branch",
    entityId: details.branchId,
    metadata: auditActor.metadata,
  });
}

export async function confirmProviderBusinessDetails(
  actor: Actor,
  input: z.input<typeof providerBusinessDetailsSchema>,
  queue: JobQueue,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const parsed = providerBusinessDetailsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid business details.");
  const details = parsed.data;
  const resumedInvestigationId = await database.transaction(async (tx) => {
    const [branch] = await tx
      .select({
        detailsSource: branches.detailsSource,
      })
      .from(branches)
      .where(eq(branches.id, details.branchId))
      .for("update")
      .limit(1);
    if (!branch || branch.detailsSource !== "provider") {
      throw new Error("This business does not need provider details confirmed.");
    }
    const now = new Date();
    await applyFirstPartyBusinessDetails(
      tx,
      {
        branchId: details.branchId,
        name: details.name,
        address: details.address,
        city: details.city,
        website: details.website || null,
        phone: details.phone || null,
        timezone: details.timezone,
      },
      {
        actorUserId: admin.id,
        actorType: "admin",
        action: "provider_business_details_confirmed",
        metadata: { detailsSource: "first_party" },
      },
    );
    const [waiting] = await tx
      .select({ id: investigations.id })
      .from(investigations)
      .where(
        and(
          eq(investigations.branchId, details.branchId),
          eq(investigations.isActive, true),
          eq(investigations.paused, true),
          inArray(investigations.stageDetail, [
            waitingForBusinessDetails,
            waitingForAutomaticBusinessDetails,
          ]),
        ),
      )
      .limit(1);
    if (waiting) {
      await tx
        .update(investigations)
        .set({
          paused: false,
          stageDetail: "Business details confirmed. Preparing outreach.",
          updatedAt: now,
        })
        .where(eq(investigations.id, waiting.id));
    }
    return waiting?.id ?? null;
  });
  if (resumedInvestigationId) {
    await queue.enqueue(
      "investigation.prepare_outreach",
      { investigationId: resumedInvestigationId },
      { singletonKey: `prepare_outreach:${resumedInvestigationId}` },
    );
  }
  return { resumedInvestigationId };
}

export async function addContactEndpoint(
  actor: Actor,
  input: {
    branchId: string;
    value: string;
    kind: "email" | "phone" | "web_form";
    notes?: string;
    isPersonal: boolean;
  },
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  if (!input.value.trim()) throw new Error("Contact value is required.");
  const [row] = await database
    .insert(contactEndpoints)
    .values({
      branchId: input.branchId,
      value: input.value.trim().slice(0, 500),
      kind: input.kind,
      notes: input.notes?.trim().slice(0, 1000) || null,
      isPersonal: input.isPersonal,
      status: "unverified",
    })
    .returning({ id: contactEndpoints.id });
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "contact_endpoint_added",
    entityType: "contact_endpoint",
    entityId: row!.id,
  });
  return row!;
}

export async function editOutreachDraft(
  actor: Actor,
  messageId: string,
  input: { subject: string; bodyText: string; questions: string[] },
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  if (!input.subject.trim() || !input.bodyText.trim()) {
    throw new Error("Draft subject and body are required.");
  }
  const [row] = await database
    .update(outreachMessages)
    .set({
      subject: input.subject.trim().slice(0, 500),
      bodyText: input.bodyText.trim().slice(0, 10000),
      questions: [...new Set(input.questions)],
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(outreachMessages.id, messageId),
        eq(outreachMessages.direction, "outbound"),
        eq(outreachMessages.status, "draft"),
      ),
    )
    .returning({ id: outreachMessages.id });
  if (!row) throw new Error("Draft message not found or already reviewed.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "outreach_draft_edited",
    entityType: "outreach_message",
    entityId: messageId,
  });
}

export async function updateSourceExcerpt(
  actor: Actor,
  sourceId: string,
  input: { publicExcerpt: string; isPublic: boolean },
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const excerpt = redactPublicExcerpt(input.publicExcerpt.trim());
  const [row] = await database
    .update(sources)
    .set({
      publicExcerpt: excerpt || null,
      isPublic: input.isPublic,
      updatedAt: new Date(),
    })
    .where(eq(sources.id, sourceId))
    .returning({ id: sources.id });
  if (!row) throw new Error("Source not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "source_excerpt_updated",
    entityType: "source",
    entityId: sourceId,
    metadata: { isPublic: input.isPublic },
  });
}

export async function reviewContactEndpoint(
  actor: Actor,
  endpointId: string,
  status: "approved" | "rejected" | "ambiguous",
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [row] = await database
    .update(contactEndpoints)
    .set({ status, updatedAt: new Date() })
    .where(eq(contactEndpoints.id, endpointId))
    .returning({ id: contactEndpoints.id });
  if (!row) throw new Error("Contact endpoint not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: `contact_endpoint_${status}`,
    entityType: "contact_endpoint",
    entityId: endpointId,
  });
}

export async function reviewCertificate(
  actor: Actor,
  certificateId: string,
  input: {
    status: "accepted" | "rejected";
    validFrom: string | null;
    validUntil: string | null;
    coversBranch: boolean | null;
  },
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [row] = await database
    .update(certificates)
    .set({
      reviewStatus: input.status,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      coversBranch: input.coversBranch,
      reviewedBy: admin.id,
      updatedAt: new Date(),
    })
    .where(eq(certificates.id, certificateId))
    .returning({ id: certificates.id });
  if (!row) throw new Error("Certificate not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action:
      input.status === "accepted"
        ? "certificate_accepted"
        : "certificate_rejected",
    entityType: "certificate",
    entityId: certificateId,
    metadata: {
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      coversBranch: input.coversBranch,
    },
  });
}

export async function editProposedClaim(
  actor: Actor,
  claimId: string,
  value: string,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  if (!value.trim()) throw new Error("Claim value is required.");
  const [row] = await database
    .update(claims)
    .set({ value: value.trim().slice(0, 1000), updatedAt: new Date() })
    .where(and(eq(claims.id, claimId), eq(claims.status, "proposed")))
    .returning({ id: claims.id });
  if (!row) throw new Error("Proposed claim not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "proposed_claim_edited",
    entityType: "claim",
    entityId: claimId,
  });
}

export async function removeSuppression(
  actor: Actor,
  suppressionId: string,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [row] = await database
    .delete(suppressions)
    .where(eq(suppressions.id, suppressionId))
    .returning({
      id: suppressions.id,
      valueNormalized: suppressions.valueNormalized,
    });
  if (!row) throw new Error("Suppression not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "suppression_removed",
    entityType: "suppression",
    entityId: row.id,
    metadata: { value: row.valueNormalized },
  });
}

export async function dismissUnexpectedReply(
  actor: Actor,
  replyId: string,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [row] = await database
    .update(unexpectedReplies)
    .set({ reviewStatus: "dismissed", updatedAt: new Date() })
    .where(eq(unexpectedReplies.id, replyId))
    .returning({ id: unexpectedReplies.id });
  if (!row) throw new Error("Unexpected reply not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "unexpected_reply_dismissed",
    entityType: "unexpected_reply",
    entityId: replyId,
  });
}

export async function assignUnexpectedReply(
  actor: Actor,
  replyId: string,
  threadId: string,
  queue: JobQueue,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [reply] = await database
    .select()
    .from(unexpectedReplies)
    .where(eq(unexpectedReplies.id, replyId))
    .limit(1);
  const [thread] = await database
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.id, threadId))
    .limit(1);
  if (!reply || !thread) throw new Error("Reply or thread not found.");
  await ingestInboundEmail(
    actor,
    {
      provider: "admin-assignment",
      eventId: randomUUID(),
      from: reply.fromAddress,
      to: `reply+${thread.threadToken}@demo.halalcheck.test`,
      subject: reply.subject,
      text: reply.bodyText,
      receivedAt: reply.receivedAt,
    },
    queue,
    database,
  );
  await database
    .update(unexpectedReplies)
    .set({ reviewStatus: "assigned", updatedAt: new Date() })
    .where(eq(unexpectedReplies.id, replyId));
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "unexpected_reply_assigned",
    entityType: "unexpected_reply",
    entityId: replyId,
    metadata: { threadId },
  });
}

export async function convertCorrectionToRefresh(
  actor: Actor,
  correctionId: string,
  queue: JobQueue,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [correction] = await database
    .select()
    .from(corrections)
    .where(eq(corrections.id, correctionId))
    .limit(1);
  if (!correction || correction.status !== "accepted") {
    throw new Error("Only an accepted correction can trigger a refresh.");
  }
  const [active] = await database
    .select({ id: investigations.id })
    .from(investigations)
    .where(
      and(
        eq(investigations.branchId, correction.branchId),
        eq(investigations.isActive, true),
      ),
    )
    .limit(1);
  let investigationId = active?.id;
  if (!investigationId) {
    const [created] = await database
      .insert(investigations)
      .values({
        branchId: correction.branchId,
        kind: "refresh",
        status: "queued",
        isActive: true,
      })
      .onConflictDoNothing()
      .returning({ id: investigations.id });
    investigationId = created?.id;
  }
  if (!investigationId)
    throw new Error("A refresh investigation already exists.");
  await database
    .update(corrections)
    .set({ status: "converted", updatedAt: new Date() })
    .where(eq(corrections.id, correctionId));
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "correction_converted_to_refresh",
    entityType: "correction",
    entityId: correctionId,
    metadata: { investigationId },
  });
  await queue.enqueue(
    "investigation.public_research",
    { investigationId },
    { singletonKey: `public_research:${investigationId}` },
  );
  return investigationId;
}
