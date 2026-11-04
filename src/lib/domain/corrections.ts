import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import { branchFollows, branches, corrections, evidenceDocuments, favorites, sources } from "@/db/schema";
import { storeEvidenceUpload } from "@/lib/providers/storage/local";
import type { Actor } from "./actor";
import { requireAdminActor, requireActorUser } from "./actor";
import { writeAudit } from "./audit";
import { consumeRateLimit } from "./rate-limit";

const correctionSchema = z.object({
  body: z.string().trim().min(10).max(5000),
  url: z.string().url().max(2000).nullable().optional(),
  isOwnerSubmission: z.boolean().default(false),
});

export async function submitCorrection(
  actor: Actor,
  branchId: string,
  input: { body: string; url?: string | null; isOwnerSubmission?: boolean; file?: File | null },
  database: typeof defaultDb = defaultDb,
) {
  const user = await requireActorUser(actor, database);
  const rate = await consumeRateLimit(database, `correction:${user.id}`, 5, 86400_000);
  if (!rate.allowed) throw new Error("Correction submission rate limit exceeded.");
  const parsed = correctionSchema.parse(input);
  const [branch] = await database.select({ id: branches.id }).from(branches).where(eq(branches.id, branchId)).limit(1);
  if (!branch) throw new Error("Branch not found.");
  let evidenceDocumentId: string | undefined;
  if (input.file && input.file.size) {
    const bytes = new Uint8Array(await input.file.arrayBuffer());
    const stored = await storeEvidenceUpload(bytes, input.file.type, input.file.name);
    const [source] = await database
      .insert(sources)
      .values({
        branchId,
        kind: parsed.isOwnerSubmission ? "owner_submission" : "correction",
        title: "Private correction attachment",
        rawText: null,
        isPublic: false,
      })
      .returning({ id: sources.id });
    const [document] = await database
      .insert(evidenceDocuments)
      .values({ sourceId: source!.id, ...stored, isPublic: false })
      .returning({ id: evidenceDocuments.id });
    evidenceDocumentId = document?.id;
  }
  const [correction] = await database
    .insert(corrections)
    .values({
      branchId,
      userId: user.id,
      body: parsed.body,
      url: parsed.url ?? null,
      isOwnerSubmission: parsed.isOwnerSubmission,
      evidenceDocumentId,
      status: "open",
    })
    .returning({ id: corrections.id });
  await writeAudit(database, {
    actorUserId: user.id,
    actorType: user.role,
    action: "correction_submitted",
    entityType: "correction",
    entityId: correction!.id,
    metadata: { branchId, ownerSubmission: parsed.isOwnerSubmission },
  });
  return correction!;
}

export async function reviewCorrection(
  actor: Actor,
  correctionId: string,
  decision: "accepted" | "rejected",
  adminNote: string,
  database: typeof defaultDb = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [row] = await database
    .update(corrections)
    .set({
      status: decision,
      adminNote: adminNote.slice(0, 3000),
      reviewedBy: admin.id,
      updatedAt: new Date(),
    })
    .where(and(eq(corrections.id, correctionId), eq(corrections.status, "open")))
    .returning({ id: corrections.id, userId: corrections.userId, branchId: corrections.branchId });
  if (!row) throw new Error("Open correction not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: `correction_${decision}`,
    entityType: "correction",
    entityId: correctionId,
    metadata: { branchId: row.branchId },
  });
  return row;
}

export async function followBranch(actor: Actor, branchId: string, database: typeof defaultDb = defaultDb) {
  const user = await requireActorUser(actor, database);
  const [row] = await database
    .insert(branchFollows)
    .values({ userId: user.id, branchId })
    .onConflictDoNothing()
    .returning({ id: branchFollows.id });
  return { followed: Boolean(row) };
}

export async function toggleFavorite(actor: Actor, branchId: string, database: typeof defaultDb = defaultDb) {
  const user = await requireActorUser(actor, database);
  const [existing] = await database
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.userId, user.id), eq(favorites.branchId, branchId)))
    .limit(1);
  if (existing) {
    await database.delete(favorites).where(eq(favorites.id, existing.id));
    return { favorited: false };
  }
  await database.insert(favorites).values({ userId: user.id, branchId }).onConflictDoNothing();
  return { favorited: true };
}
