import { and, desc, eq, inArray } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  branches,
  certificates,
  claims,
  contactEndpoints,
  investigations,
  outreachMessages,
  outreachSettings,
  outreachThreads,
  proposedUpdates,
  sources,
  suppressions,
} from "@/db/schema";
import { getAIProvider, type OpenQuestion } from "@/lib/providers/ai";
import { isExcerptInText } from "@/lib/providers/ai/openai";
import type { JobQueue } from "@/lib/jobs/types";
import type { Actor } from "./actor";
import { requireAdminActor } from "./actor";
import { writeAudit } from "./audit";
import {
  openQuestionKeysForClaims,
  researchQuestions,
  createOutreachDraft,
} from "./outreach";

type Database = typeof defaultDb;

export async function parseInboundReply(
  actor: Actor,
  messageId: string,
  queue: JobQueue,
  database: Database = defaultDb,
) {
  if (actor.type !== "worker" && actor.type !== "system")
    throw new Error("Worker access required.");
  const [message] = await database
    .select()
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.id, messageId),
        eq(outreachMessages.direction, "inbound"),
      ),
    )
    .limit(1);
  if (!message) throw new Error("Inbound message not found.");
  const [thread] = await database
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.id, message.threadId))
    .limit(1);
  if (!thread || thread.status !== "open")
    return { parsed: false, reason: "thread-closed" };
  const [source] = await database
    .select({ id: sources.id })
    .from(sources)
    .where(
      and(eq(sources.messageId, message.id), eq(sources.kind, "email_reply")),
    )
    .limit(1);
  const [replyTarget] = message.inReplyTo
    ? await database
        .select({
          questions: outreachMessages.questions,
          kind: outreachMessages.kind,
          sequence: outreachMessages.sequence,
        })
        .from(outreachMessages)
        .where(
          and(
            eq(outreachMessages.threadId, thread.id),
            eq(outreachMessages.direction, "outbound"),
            eq(outreachMessages.messageIdHeader, message.inReplyTo),
          ),
        )
        .limit(1)
    : [];
  const [latestOutbound] = replyTarget
    ? [replyTarget]
    : await database
        .select({
          questions: outreachMessages.questions,
          kind: outreachMessages.kind,
          sequence: outreachMessages.sequence,
        })
        .from(outreachMessages)
        .where(
          and(
            eq(outreachMessages.threadId, thread.id),
            eq(outreachMessages.direction, "outbound"),
          ),
        )
        .orderBy(desc(outreachMessages.sequence))
        .limit(1);
  const requestedQuestions = latestOutbound?.questions.length
    ? researchQuestions.filter((question) =>
        latestOutbound.questions.includes(question.key),
      )
    : researchQuestions;
  const openQuestions: OpenQuestion[] = requestedQuestions.map((question) => ({
    key: question.key,
    prompt: question.prompt,
    product: question.product,
    attribute: question.attribute,
  }));
  const parsed = await getAIProvider().parseReply(
    message.bodyText,
    openQuestions,
  );

  if (parsed.optOut) {
    const [endpoint] = thread.contactEndpointId
      ? await database
          .select()
          .from(contactEndpoints)
          .where(eq(contactEndpoints.id, thread.contactEndpointId))
          .limit(1)
      : [];
    await database.transaction(async (tx) => {
      if (endpoint) {
        await tx
          .insert(suppressions)
          .values({
            valueNormalized: endpoint.value.trim().toLowerCase(),
            kind: "email",
            reason: "opt_out",
          })
          .onConflictDoNothing();
      }
      await tx
        .update(outreachThreads)
        .set({ status: "opted_out", updatedAt: new Date() })
        .where(eq(outreachThreads.id, thread.id));
      await tx
        .update(outreachMessages)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(outreachMessages.threadId, thread.id),
            eq(outreachMessages.direction, "outbound"),
            inArray(outreachMessages.status, [
              "draft",
              "approved",
              "scheduled",
            ]),
          ),
        );
      await writeAudit(tx, {
        actorType: "worker",
        action: "outreach_opt_out",
        entityType: "outreach_thread",
        entityId: thread.id,
      });
    });
    return { parsed: true, optOut: true, claimsCreated: 0 };
  }
  if (parsed.refusal) {
    await database
      .update(outreachThreads)
      .set({ status: "refused", updatedAt: new Date() })
      .where(eq(outreachThreads.id, thread.id));
    await database
      .insert(suppressions)
      .values({
        valueNormalized:
          (
            await database
              .select({ value: contactEndpoints.value })
              .from(contactEndpoints)
              .where(eq(contactEndpoints.id, thread.contactEndpointId ?? ""))
              .limit(1)
          )[0]?.value.toLowerCase() ?? `thread:${thread.id}`,
        kind: "email",
        reason: "refusal",
      })
      .onConflictDoNothing();
    return { parsed: true, refusal: true, claimsCreated: 0 };
  }

  const validAnswers = parsed.answers.filter(
    (answer) =>
      answer.specificity === "specific" &&
      isExcerptInText(answer.excerpt, message.bodyText) &&
      openQuestions.some((question) => question.key === answer.questionKey),
  );
  const existingClaims = await database
    .select({
      id: claims.id,
      product: claims.product,
      attribute: claims.attribute,
      value: claims.value,
      valueEnum: claims.valueEnum,
      status: claims.status,
      sourceId: claims.sourceId,
    })
    .from(claims)
    .where(
      and(
        eq(claims.branchId, thread.branchId),
        inArray(claims.status, ["published", "proposed"]),
      ),
    );
  const conflictClaimIds: string[] = [];
  const conflictingAnswers = validAnswers.some((answer, index) =>
    validAnswers
      .slice(index + 1)
      .some(
        (other) =>
          answer.product === other.product &&
          answer.attribute === other.attribute &&
          (answer.valueEnum ?? answer.value).toLowerCase() !==
            (other.valueEnum ?? other.value).toLowerCase(),
      ),
  );
  let claimsCreated = 0;
  for (const answer of validAnswers) {
    const conflicts = existingClaims.filter(
      (current) =>
        current.product === answer.product &&
        current.attribute === answer.attribute &&
        (current.valueEnum ?? current.value).toLowerCase() !==
          (answer.valueEnum ?? answer.value).toLowerCase(),
    );
    conflictClaimIds.push(
      ...conflicts
        .filter(
          (claim) =>
            claim.status === "proposed" && claim.sourceId !== source?.id,
        )
        .map((claim) => claim.id),
    );
    const valueEnum =
      answer.specificity === "vague" ? "unknown" : answer.valueEnum;
    const [createdClaim] = await database
      .insert(claims)
      .values({
        branchId: thread.branchId,
        investigationId: thread.investigationId,
        product: answer.product,
        attribute: answer.attribute,
        value: answer.value,
        valueEnum,
        evidenceCategory: "restaurant_claim",
        status: "proposed",
        idempotencyKey: `reply-claim:${message.id}:${answer.questionKey}:${answer.product}:${answer.attribute}`,
        confirmedAt:
          message.receivedAt?.toISOString().slice(0, 10) ??
          new Date().toISOString().slice(0, 10),
        sourceId: source?.id,
        supportingExcerpt: answer.excerpt,
      })
      .onConflictDoNothing()
      .returning({ id: claims.id });
    if (createdClaim) claimsCreated++;
  }
  if (parsed.referral) {
    await database
      .insert(contactEndpoints)
      .values({
        branchId: thread.branchId,
        kind: "email",
        value: parsed.referral.email,
        status: "ambiguous",
        sourceId: source?.id,
        isPersonal: true,
        notes: "Referred by business reply — needs review",
      })
      .onConflictDoNothing();
  }
  if (
    parsed.staffDontKnow ||
    parsed.vagueSignals.includes("general_halal_claim")
  ) {
    const detail = parsed.staffDontKnow
      ? "Business staff did not know the requested information; ask for a manager or purchasing contact."
      : "Business made a general halal claim; supplier and certifier details remain unconfirmed.";
    await database
      .update(investigations)
      .set({ stageDetail: detail, updatedAt: new Date() })
      .where(eq(investigations.id, thread.investigationId));
  }
  if (conflictClaimIds.length || conflictingAnswers) {
    await writeAudit(database, {
      actorType: "worker",
      action: "claim_conflict_detected",
      entityType: "investigation",
      entityId: thread.investigationId,
      metadata: {
        claimCount: conflictClaimIds.length + (conflictingAnswers ? 1 : 0),
      },
    });
    await database
      .update(investigations)
      .set({
        status: "reviewing_evidence",
        stageDetail: "Conflicting answers detected; evidence review required.",
        updatedAt: new Date(),
      })
      .where(eq(investigations.id, thread.investigationId));
    await queue.enqueue(
      "investigation.evidence_review",
      { investigationId: thread.investigationId },
      { singletonKey: `evidence_review:${thread.investigationId}` },
    );
    return { parsed: true, conflict: true, claimsCreated };
  }

  const updatedClaims = await database
    .select({
      product: claims.product,
      attribute: claims.attribute,
      value: claims.value,
      valueEnum: claims.valueEnum,
    })
    .from(claims)
    .where(
      and(
        eq(claims.branchId, thread.branchId),
        inArray(claims.status, ["published", "proposed"]),
      ),
    );
  const stillOpen = openQuestionKeysForClaims(updatedClaims);
  const [settings] = await database.select().from(outreachSettings).limit(1);
  const maxFollowups = settings?.maxFollowups ?? 2;
  const followupsObservedInThread =
    replyTarget?.kind === "followup"
      ? Math.max(thread.followupsSent, replyTarget.sequence - 1)
      : thread.followupsSent;
  if (stillOpen.length && followupsObservedInThread < maxFollowups) {
    await createOutreachDraft(actor, thread.investigationId, database, queue, {
      vagueSignals: parsed.vagueSignals,
    });
    return { parsed: true, claimsCreated, followupDrafted: true };
  }
  await database
    .update(investigations)
    .set({ status: "reviewing_evidence", updatedAt: new Date() })
    .where(eq(investigations.id, thread.investigationId));
  await database
    .update(branches)
    .set({ researchStatus: "reviewing_evidence", updatedAt: new Date() })
    .where(eq(branches.id, thread.branchId));
  await queue.enqueue(
    "investigation.evidence_review",
    { investigationId: thread.investigationId },
    { singletonKey: `evidence_review:${thread.investigationId}` },
  );
  return {
    parsed: true,
    claimsCreated,
    followupDrafted: false,
    unanswered: stillOpen.map((question) => question.key),
  };
}

export async function reviewEvidence(
  actor: Actor,
  investigationId: string,
  database: Database = defaultDb,
) {
  if (actor.type !== "worker" && actor.type !== "system")
    throw new Error("Worker access required.");
  const [investigation] = await database
    .select()
    .from(investigations)
    .where(eq(investigations.id, investigationId))
    .limit(1);
  if (!investigation) throw new Error("Investigation not found.");
  const [pending] = await database
    .select({ id: proposedUpdates.id })
    .from(proposedUpdates)
    .where(
      and(
        eq(proposedUpdates.investigationId, investigationId),
        eq(proposedUpdates.status, "pending"),
      ),
    )
    .limit(1);
  if (pending) return pending.id;
  const branchClaims = await database
    .select()
    .from(claims)
    .where(
      and(
        eq(claims.branchId, investigation.branchId),
        inArray(claims.status, ["published", "proposed"]),
      ),
    );
  const proposedClaims = branchClaims.filter(
    (claim) => claim.status === "proposed",
  );
  const openQuestions = openQuestionKeysForClaims(branchClaims);
  const flags: Array<{ type: string; detail: string; claimIds: string[] }> = [];
  for (let i = 0; i < branchClaims.length; i++) {
    for (let j = i + 1; j < branchClaims.length; j++) {
      const first = branchClaims[i]!;
      const second = branchClaims[j]!;
      if (
        first.status !== "published" &&
        second.status !== "published" &&
        first.sourceId !== second.sourceId &&
        first.product === second.product &&
        first.attribute === second.attribute &&
        (first.valueEnum ?? first.value).toLowerCase() !==
          (second.valueEnum ?? second.value).toLowerCase()
      ) {
        flags.push({
          type: "contradiction",
          detail: `Conflicting evidence for ${first.product} ${first.attribute}.`,
          claimIds: [first.id, second.id],
        });
      }
    }
  }
  const certificatesForBranch = await database
    .select()
    .from(certificates)
    .where(
      and(
        eq(certificates.branchId, investigation.branchId),
        inArray(certificates.reviewStatus, ["accepted", "pending"]),
      ),
    );
  for (const certificate of certificatesForBranch) {
    if (
      certificate.validUntil &&
      certificate.validUntil < new Date().toISOString().slice(0, 10)
    ) {
      flags.push({
        type: "expired_certificate",
        detail: "A pending or accepted certificate has expired.",
        claimIds: [],
      });
    }
    if (certificate.coversBranch !== true) {
      flags.push({
        type: "missing_branch_coverage",
        detail: "Certificate scope does not confirm this branch.",
        claimIds: [],
      });
    }
  }
  if (investigation.stageDetail?.startsWith("Conflicting answers detected")) {
    flags.push({
      type: "contradiction",
      detail: investigation.stageDetail,
      claimIds: proposedClaims.map((claim) => claim.id),
    });
  }
  if (openQuestions.length) {
    flags.push({
      type: "unanswered",
      detail: `${openQuestions.length} research question(s) remain unanswered.`,
      claimIds: [],
    });
  }
  for (const proposed of proposedClaims) {
    const old = branchClaims.find(
      (claim) =>
        claim.status === "published" &&
        claim.product === proposed.product &&
        claim.attribute === proposed.attribute &&
        (claim.valueEnum ?? claim.value).toLowerCase() !==
          (proposed.valueEnum ?? proposed.value).toLowerCase(),
    );
    if (old) {
      flags.push({
        type: "material_change",
        detail: `Updated information differs from previously published ${proposed.product} ${proposed.attribute}.`,
        claimIds: [proposed.id],
      });
    }
  }
  const summary =
    proposedClaims.length > 0
      ? `Research found ${proposedClaims.length} proposed item(s) for review. ${openQuestions.length} question(s) remain unanswered.`
      : "We could not confirm current findings. This is not a finding that the food is non-halal.";
  const [proposal] = await database
    .insert(proposedUpdates)
    .values({
      branchId: investigation.branchId,
      investigationId,
      publicSummary: summary,
      unansweredQuestions: openQuestions.map((question) => question.key),
      flags,
      status: "pending",
    })
    .onConflictDoNothing()
    .returning({ id: proposedUpdates.id });
  if (!proposal) {
    const [existing] = await database
      .select({ id: proposedUpdates.id })
      .from(proposedUpdates)
      .where(
        and(
          eq(proposedUpdates.investigationId, investigationId),
          eq(proposedUpdates.status, "pending"),
        ),
      )
      .limit(1);
    if (existing) return existing.id;
    throw new Error("Evidence proposal could not be created.");
  }
  await database.transaction(async (tx) => {
    if (proposedClaims.length) {
      await tx
        .update(claims)
        .set({ proposedUpdateId: proposal!.id, updatedAt: new Date() })
        .where(
          inArray(
            claims.id,
            proposedClaims.map((claim) => claim.id),
          ),
        );
    }
    await tx
      .update(investigations)
      .set({
        status: "reviewing_evidence",
        stageDetail: "Evidence proposal awaits administrator review.",
        updatedAt: new Date(),
      })
      .where(eq(investigations.id, investigationId));
    await tx
      .update(branches)
      .set({ researchStatus: "reviewing_evidence", updatedAt: new Date() })
      .where(eq(branches.id, investigation.branchId));
  });
  return proposal!.id;
}

export async function closeInvestigationUnableToConfirm(
  actor: Actor,
  investigationId: string,
  queue: JobQueue,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [investigation] = await database
    .select()
    .from(investigations)
    .where(eq(investigations.id, investigationId))
    .limit(1);
  if (!investigation) throw new Error("Investigation not found.");
  const [existing] = await database
    .select({ id: proposedUpdates.id })
    .from(proposedUpdates)
    .where(
      and(
        eq(proposedUpdates.investigationId, investigationId),
        eq(proposedUpdates.status, "pending"),
      ),
    )
    .limit(1);
  if (existing) return existing.id;
  const [proposal] = await database
    .insert(proposedUpdates)
    .values({
      branchId: investigation.branchId,
      investigationId,
      status: "pending",
      publicSummary:
        "We could not confirm current findings. This is not a finding that the food is non-halal.",
      unansweredQuestions: researchQuestions.map((question) => question.key),
      flags: [
        {
          type: "unanswered",
          detail: "No confirming evidence was available.",
          claimIds: [],
        },
      ],
    })
    .onConflictDoNothing()
    .returning({ id: proposedUpdates.id });
  if (!proposal) throw new Error("Unable to create an evidence proposal.");
  await writeAudit(database, {
    actorType: "admin",
    actorUserId: admin.id,
    action: "investigation_marked_unable_to_confirm",
    entityType: "proposed_update",
    entityId: proposal!.id,
  });
  await database.transaction(async (tx) => {
    await tx
      .update(investigations)
      .set({
        status: "reviewing_evidence",
        stageDetail: "Unable-to-confirm proposal awaits review.",
        updatedAt: new Date(),
      })
      .where(eq(investigations.id, investigationId));
    await tx
      .update(branches)
      .set({ researchStatus: "reviewing_evidence", updatedAt: new Date() })
      .where(eq(branches.id, investigation.branchId));
  });
  void queue;
  return proposal!.id;
}
