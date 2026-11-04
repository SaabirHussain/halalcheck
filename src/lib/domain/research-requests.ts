import { and, eq, sql } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  branches,
  branchFollows,
  investigationSubscriptions,
  investigations,
} from "@/db/schema";
import type { JobQueue } from "@/lib/jobs/types";
import type { Actor } from "./actor";
import { requireActorUser } from "./actor";
import { writeAudit } from "./audit";
import { consumeRateLimit } from "./rate-limit";

type ResearchDatabase = typeof defaultDb;

export async function requestResearch(
  actor: Actor,
  branchId: string,
  queue: JobQueue,
  database: ResearchDatabase = defaultDb,
) {
  const user = await requireActorUser(actor, database);
  const rate = await consumeRateLimit(
    database,
    `research:${user.id}`,
    10,
    60 * 60 * 1000,
  );
  if (!rate.allowed) throw new Error("Research request rate limit exceeded.");

  const result = await database.transaction(async (tx) => {
    const [branch] = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    if (!branch) throw new Error("Branch not found.");

    const [created] = await tx
      .insert(investigations)
      .values({
        branchId,
        kind: "initial",
        status: "queued",
        isActive: true,
        createdBy: user.id,
      })
      .onConflictDoNothing({
        target: investigations.branchId,
        where: sql`${investigations.isActive} = true`,
      })
      .returning({ id: investigations.id });
    const [existing] = created
      ? []
      : await tx
          .select({ id: investigations.id })
          .from(investigations)
          .where(
            and(
              eq(investigations.branchId, branchId),
              eq(investigations.isActive, true),
            ),
          )
          .limit(1);
    const investigationId = created?.id ?? existing?.id;
    if (!investigationId)
      throw new Error("Unable to create or join investigation.");

    await tx
      .insert(investigationSubscriptions)
      .values({ investigationId, userId: user.id })
      .onConflictDoNothing();
    await tx
      .insert(branchFollows)
      .values({ userId: user.id, branchId })
      .onConflictDoNothing();
    if (created) {
      await tx
        .update(branches)
        .set({ researchStatus: "queued", updatedAt: new Date() })
        .where(eq(branches.id, branchId));
    }
    await writeAudit(tx, {
      actorUserId: user.id,
      actorType: user.role,
      action: created ? "research_requested" : "research_joined",
      entityType: "investigation",
      entityId: investigationId,
      metadata: { branchId, joinedExisting: !created },
    });
    return { investigationId, joinedExisting: !created };
  });

  if (!result.joinedExisting) {
    await queue.enqueue(
      "investigation.public_research",
      { investigationId: result.investigationId },
      { singletonKey: `public_research:${result.investigationId}` },
    );
  }
  return result;
}
