import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  branches,
  investigations,
  jobRuns,
  outreachMessages,
  outreachThreads,
  publishedRevisions,
} from "@/db/schema";
import type { JobQueue } from "@/lib/jobs/types";
import type { Actor } from "./actor";
import { requireAdminActor } from "./actor";
import { writeAudit } from "./audit";

type Database = typeof defaultDb;

export async function pauseInvestigation(
  actor: Actor,
  investigationId: string,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [row] = await database
    .update(investigations)
    .set({ paused: true, updatedAt: new Date() })
    .where(
      and(
        eq(investigations.id, investigationId),
        eq(investigations.isActive, true),
      ),
    )
    .returning({ id: investigations.id });
  if (!row) throw new Error("Active investigation not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "investigation_paused",
    entityType: "investigation",
    entityId: row.id,
  });
}

export async function resumeInvestigation(
  actor: Actor,
  investigationId: string,
  queue: JobQueue,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [row] = await database
    .update(investigations)
    .set({ paused: false, updatedAt: new Date() })
    .where(
      and(
        eq(investigations.id, investigationId),
        eq(investigations.isActive, true),
      ),
    )
    .returning({ id: investigations.id, status: investigations.status });
  if (!row) throw new Error("Active investigation not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "investigation_resumed",
    entityType: "investigation",
    entityId: row.id,
  });
  const pendingMessages = await database
    .select({
      id: outreachMessages.id,
      scheduledFor: outreachMessages.scheduledFor,
    })
    .from(outreachMessages)
    .innerJoin(
      outreachThreads,
      eq(outreachMessages.threadId, outreachThreads.id),
    )
    .where(
      and(
        eq(outreachThreads.investigationId, investigationId),
        eq(outreachMessages.direction, "outbound"),
        inArray(outreachMessages.status, ["approved", "scheduled"]),
      ),
    );
  for (const message of pendingMessages) {
    const retryKey = `outreach:${message.id}:resume:${randomUUID()}`;
    await queue.enqueue(
      "outreach.send",
      { messageId: message.id },
      {
        idempotencyKey: retryKey,
        singletonKey: retryKey,
        ...(message.scheduledFor ? { startAfter: message.scheduledFor } : {}),
      },
    );
  }
  const queueName = stageQueue(row.status);
  if (queueName) {
    await queue.enqueue(
      queueName,
      { investigationId },
      { singletonKey: `${queueName}:${investigationId}` },
    );
  }
}

export async function cancelInvestigation(
  actor: Actor,
  investigationId: string,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [row] = await database
    .select({ id: investigations.id, branchId: investigations.branchId })
    .from(investigations)
    .where(
      and(
        eq(investigations.id, investigationId),
        eq(investigations.isActive, true),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Active investigation not found.");
  const [latest] = await database
    .select({ id: publishedRevisions.id })
    .from(publishedRevisions)
    .where(eq(publishedRevisions.branchId, row.branchId))
    .orderBy(desc(publishedRevisions.revisionNumber))
    .limit(1);
  const status = latest ? "findings_published" : "not_researched";
  await database.transaction(async (tx) => {
    const threadRows = await tx
      .select({ id: outreachThreads.id })
      .from(outreachThreads)
      .where(eq(outreachThreads.investigationId, investigationId));
    if (threadRows.length) {
      await tx
        .update(outreachMessages)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            inArray(
              outreachMessages.threadId,
              threadRows.map((thread) => thread.id),
            ),
            eq(outreachMessages.direction, "outbound"),
            inArray(outreachMessages.status, [
              "draft",
              "approved",
              "scheduled",
            ]),
          ),
        );
    }
    await tx
      .update(investigations)
      .set({
        status,
        stageDetail: latest
          ? "Research request closed by an administrator. Existing findings remain published."
          : "Research request closed by an administrator without published findings.",
        isActive: false,
        cancelledAt: new Date(),
        outcome: "cancelled by administrator",
        updatedAt: new Date(),
      })
      .where(eq(investigations.id, investigationId));
    await tx
      .update(branches)
      .set({ researchStatus: status, updatedAt: new Date() })
      .where(eq(branches.id, row.branchId));
    await tx
      .update(jobRuns)
      .set({
        status: "cancelled",
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jobRuns.investigationId, investigationId),
          eq(jobRuns.status, "queued"),
        ),
      );
    await writeAudit(tx, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "investigation_cancelled",
      entityType: "investigation",
      entityId: investigationId,
    });
  });
}

export async function retryFailedStage(
  actor: Actor,
  jobRunId: string,
  queue: JobQueue,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [job] = await database
    .select()
    .from(jobRuns)
    .where(and(eq(jobRuns.id, jobRunId), eq(jobRuns.status, "failed")))
    .limit(1);
  if (!job) throw new Error("Failed job run not found.");
  const key = `${job.idempotencyKey}:retry:${randomUUID()}`;
  const jobId = await queue.enqueue(
    job.jobName,
    Object.keys(job.payload).length
      ? job.payload
      : { investigationId: job.investigationId ?? "" },
    { idempotencyKey: key },
  );
  if (!jobId) throw new Error("Retry job could not be queued.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "investigation_stage_retried",
    entityType: "job_run",
    entityId: job.id,
    metadata: { jobName: job.jobName },
  });
}

export function stageQueue(status: string) {
  const names: Record<string, string> = {
    queued: "investigation.public_research",
    checking_public_sources: "investigation.public_research",
    awaiting_business_response: "outreach.no_response_check",
    reviewing_evidence: "investigation.evidence_review",
  };
  return names[status];
}
