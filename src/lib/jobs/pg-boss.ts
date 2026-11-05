import { randomUUID } from "node:crypto";
import PgBoss from "pg-boss";
import { and, eq, inArray } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  investigations,
  jobRuns,
  outreachMessages,
  outreachThreads,
} from "@/db/schema";
import type { EnqueueOptions, JobHandler, JobQueue } from "./types";

export class PgBossQueue implements JobQueue {
  constructor(
    readonly boss: PgBoss,
    private readonly database: typeof defaultDb = defaultDb,
  ) {}

  async enqueue<T extends Record<string, unknown>>(
    name: string,
    payload: T,
    options: EnqueueOptions = {},
  ) {
    const idempotencyKey =
      options.idempotencyKey ??
      (options.singletonKey
        ? `${options.singletonKey}:${randomUUID()}`
        : `${name}:${randomUUID()}`);
    if (options.singletonKey && !options.idempotencyKey) {
      const [activeRun] = await this.database
        .select({ id: jobRuns.id })
        .from(jobRuns)
        .where(
          and(
            eq(jobRuns.jobName, name),
            eq(jobRuns.singletonKey, options.singletonKey),
            inArray(jobRuns.status, ["queued", "running"]),
          ),
        )
        .limit(1);
      if (activeRun) return null;
    }
    let investigationId =
      typeof payload.investigationId === "string"
        ? payload.investigationId
        : null;
    if (!investigationId && typeof payload.messageId === "string") {
      const [message] = await this.database
        .select({ investigationId: outreachThreads.investigationId })
        .from(outreachMessages)
        .innerJoin(
          outreachThreads,
          eq(outreachMessages.threadId, outreachThreads.id),
        )
        .where(eq(outreachMessages.id, payload.messageId))
        .limit(1);
      investigationId = message?.investigationId ?? null;
    }
    const [run] = await this.database
      .insert(jobRuns)
      .values({
        investigationId,
        jobName: name,
        idempotencyKey,
        singletonKey: options.singletonKey ?? null,
        payload,
        status: "queued",
      })
      .onConflictDoNothing()
      .returning({ id: jobRuns.id });
    if (!run) return null;
    let jobId: string | null;
    try {
      jobId = await this.boss.send(name, payload, {
        retryLimit: 3,
        retryBackoff: true,
        startAfter: options.startAfter,
      });
    } catch (error) {
      await this.database
        .update(jobRuns)
        .set({
          status: "failed",
          lastError: sanitizeJobError(error),
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobRuns.id, run.id));
      throw error;
    }
    if (jobId) {
      await this.database
        .update(jobRuns)
        .set({ pgbossJobId: jobId, updatedAt: new Date() })
        .where(eq(jobRuns.id, run.id));
    } else {
      await this.database
        .update(jobRuns)
        .set({
          status: "cancelled",
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobRuns.id, run.id));
    }
    return jobId;
  }

  async register<T extends Record<string, unknown>>(
    name: string,
    handler: JobHandler<T>,
  ) {
    await this.boss.createQueue(name, { name });
    return this.boss.work<T>(
      name,
      { batchSize: 1, includeMetadata: true },
      async (jobs) => {
        for (const job of jobs) {
          const [run] = await this.database
            .select({
              id: jobRuns.id,
              attempts: jobRuns.attempts,
              investigationId: jobRuns.investigationId,
            })
            .from(jobRuns)
            .where(eq(jobRuns.pgbossJobId, job.id))
            .limit(1);
          if (run) {
            await this.database
              .update(jobRuns)
              .set({
                status: "running",
                startedAt: new Date(),
                attempts: run.attempts + 1,
                updatedAt: new Date(),
              })
              .where(eq(jobRuns.id, run.id));
          }
          try {
            await handler(job.data as T, {
              jobId: job.id,
              attempt: job.retryCount + 1,
            });
            if (run) {
              await this.database
                .update(jobRuns)
                .set({
                  status: "succeeded",
                  finishedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(jobRuns.id, run.id));
            }
          } catch (error) {
            if (run) {
              const exhausted = job.retryCount >= job.retryLimit;
              const safeError = sanitizeJobError(error);
              await this.database
                .update(jobRuns)
                .set({
                  status: exhausted ? "failed" : "queued",
                  lastError: safeError,
                  finishedAt: exhausted ? new Date() : null,
                  updatedAt: new Date(),
                })
                .where(eq(jobRuns.id, run.id));
              if (exhausted && run.investigationId) {
                await this.database
                  .update(investigations)
                  .set({
                    stageDetail: `Stage failed: ${safeError}`,
                    updatedAt: new Date(),
                  })
                  .where(eq(investigations.id, run.investigationId));
              }
            }
            throw error;
          }
        }
      },
    );
  }
}

function sanitizeJobError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown job error";
  return message
    .replace(
      /(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi,
      "$1=[redacted]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .slice(0, 500);
}
