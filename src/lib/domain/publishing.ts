import { and, desc, eq, inArray } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  branches,
  claims,
  investigations,
  proposedUpdates,
  publishedRevisions,
  sources,
} from "@/db/schema";
import type { JobQueue } from "@/lib/jobs/types";
import type { Actor } from "./actor";
import { requireAdminActor } from "./actor";
import { writeAudit } from "./audit";
import { redactPublicExcerpt } from "./public";

type Database = typeof defaultDb;

export async function publishProposedUpdate(
  actor: Actor,
  proposalId: string,
  input: {
    approvedClaimIds: string[];
    rejectedClaimIds?: string[];
    publicSummary: string;
    changeSummary: string;
    confirmedMaterialChangeIds?: string[];
  },
  queue: JobQueue,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  if (!input.publicSummary.trim() || input.publicSummary.length > 3000) {
    throw new Error("Public summary must contain 1–3000 characters.");
  }
  const [proposal] = await database
    .select()
    .from(proposedUpdates)
    .where(
      and(
        eq(proposedUpdates.id, proposalId),
        eq(proposedUpdates.status, "pending"),
      ),
    )
    .limit(1);
  if (!proposal) throw new Error("Pending proposal not found.");
  const approvedIds = [...new Set(input.approvedClaimIds)];
  const rejectedIds = [...new Set(input.rejectedClaimIds ?? [])];
  const candidateIds = [...new Set([...approvedIds, ...rejectedIds])];
  const candidateClaims = candidateIds.length
    ? await database
        .select()
        .from(claims)
        .where(
          and(
            eq(claims.branchId, proposal.branchId),
            inArray(claims.id, candidateIds),
          ),
        )
    : [];
  if (candidateClaims.length !== candidateIds.length)
    throw new Error("Claim does not belong to this proposal branch.");
  for (const claim of candidateClaims) {
    if (claim.proposedUpdateId !== proposal.id)
      throw new Error("Claim is not part of this proposal.");
  }

  const materialIds = new Set(
    proposal.flags
      .filter((flag) => flag.type === "material_change")
      .flatMap((flag) => flag.claimIds),
  );
  const confirmed = new Set(input.confirmedMaterialChangeIds ?? []);
  for (const claimId of approvedIds) {
    if (materialIds.has(claimId) && !confirmed.has(claimId)) {
      throw new Error(
        "Material changes require explicit per-claim confirmation.",
      );
    }
  }
  const now = new Date();
  const [revision] = await database.transaction(async (tx) => {
    const [latest] = await tx
      .select({ revisionNumber: publishedRevisions.revisionNumber })
      .from(publishedRevisions)
      .where(eq(publishedRevisions.branchId, proposal.branchId))
      .orderBy(desc(publishedRevisions.revisionNumber))
      .limit(1);
    const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
    const approvedClaims = candidateClaims.filter((claim) =>
      approvedIds.includes(claim.id),
    );
    const sourcesById = approvedClaims.length
      ? await tx
          .select({
            id: sources.id,
            url: sources.url,
            title: sources.title,
            retrievedAt: sources.retrievedAt,
            kind: sources.kind,
            isPublic: sources.isPublic,
            publicExcerpt: sources.publicExcerpt,
          })
          .from(sources)
          .where(
            and(
              inArray(
                sources.id,
                approvedClaims.flatMap((claim) =>
                  claim.sourceId ? [claim.sourceId] : [],
                ),
              ),
            ),
          )
      : [];
    const sourceMap = new Map(
      sourcesById.map((source) => [
        source.id,
        source.isPublic
          ? {
              kind: source.kind,
              url: source.url,
              title: source.title,
              retrievedAt: source.retrievedAt,
              publicExcerpt: source.publicExcerpt,
            }
          : {
              kind: source.kind,
              retrievedAt: source.retrievedAt,
              isPrivate: true as const,
            },
      ]),
    );
    const publicSourceIds = new Set(
      sourcesById
        .filter((source) => source.isPublic)
        .map((source) => source.id),
    );
    const snapshot = {
      claims: approvedClaims.map((claim) => ({
        id: claim.id,
        product: claim.product,
        attribute: claim.attribute,
        value: claim.value,
        valueEnum: claim.valueEnum,
        evidenceCategory: claim.evidenceCategory,
        confirmedAt: claim.confirmedAt,
        source: claim.sourceId ? (sourceMap.get(claim.sourceId) ?? null) : null,
        publicExcerpt:
          claim.sourceId && publicSourceIds.has(claim.sourceId)
            ? redactPublicExcerpt(claim.supportingExcerpt)
            : null,
      })),
      unansweredQuestions: proposal.unansweredQuestions,
    };
    const [created] = await tx
      .insert(publishedRevisions)
      .values({
        branchId: proposal.branchId,
        revisionNumber,
        proposedUpdateId: proposal.id,
        publishedBy: admin.id,
        publishedAt: now,
        changeSummary: input.changeSummary.trim(),
        publicSummary: input.publicSummary.trim(),
        snapshot,
        outcome: approvedClaims.length
          ? "findings_published"
          : "unable_to_confirm",
      })
      .returning();
    if (!created) throw new Error("Could not create published revision.");

    for (const claim of approvedClaims) {
      await tx
        .update(claims)
        .set({ status: "superseded", updatedAt: now })
        .where(
          and(
            eq(claims.branchId, proposal.branchId),
            eq(claims.product, claim.product),
            eq(claims.attribute, claim.attribute),
            eq(claims.status, "published"),
          ),
        );
      await tx
        .update(claims)
        .set({
          status: "published",
          publishedRevisionId: created.id,
          updatedAt: now,
        })
        .where(eq(claims.id, claim.id));
    }
    if (rejectedIds.length) {
      await tx
        .update(claims)
        .set({ status: "rejected", updatedAt: now })
        .where(inArray(claims.id, rejectedIds));
    }
    const confirmedDates = approvedClaims
      .map((claim) => claim.confirmedAt)
      .filter((value): value is string => value !== null)
      .sort();
    await tx
      .update(proposedUpdates)
      .set({
        status: "approved",
        publicSummary: input.publicSummary.trim(),
        reviewedBy: admin.id,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(proposedUpdates.id, proposal.id));
    await tx
      .update(branches)
      .set({
        researchStatus: approvedClaims.length
          ? "findings_published"
          : "unable_to_confirm",
        lastReviewedAt: now,
        ...(confirmedDates.length
          ? {
              lastConfirmedAt: new Date(
                `${confirmedDates.at(-1)}T00:00:00.000Z`,
              ),
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(branches.id, proposal.branchId));
    if (proposal.investigationId) {
      await tx
        .update(investigations)
        .set({
          status: approvedClaims.length
            ? "findings_published"
            : "unable_to_confirm",
          stageDetail: approvedClaims.length
            ? "Findings published."
            : "Unable to confirm current findings. This is not a finding that the food is non-halal.",
          isActive: false,
          outcome: approvedClaims.length ? "published" : "unable to confirm",
          updatedAt: now,
        })
        .where(eq(investigations.id, proposal.investigationId));
    }
    await writeAudit(tx, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "findings_published",
      entityType: "published_revision",
      entityId: created.id,
      metadata: {
        branchId: proposal.branchId,
        revisionNumber,
        approvedClaimCount: approvedClaims.length,
      },
    });
    return [created] as const;
  });
  await queue.enqueue(
    "notify.followers",
    { revisionId: revision!.id },
    { idempotencyKey: `revision:${revision!.id}` },
  );
  return revision!;
}

export async function rejectProposedUpdate(
  actor: Actor,
  proposalId: string,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [proposal] = await database
    .update(proposedUpdates)
    .set({
      status: "rejected",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(proposedUpdates.id, proposalId),
        eq(proposedUpdates.status, "pending"),
      ),
    )
    .returning({ id: proposedUpdates.id });
  if (!proposal) throw new Error("Pending proposal not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "proposal_rejected",
    entityType: "proposed_update",
    entityId: proposalId,
  });
}
