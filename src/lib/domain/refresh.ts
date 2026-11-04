import { and, eq, gte, inArray, isNotNull, lt, lte } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  branches,
  certificates,
  corrections,
  investigations,
  jobRuns,
} from "@/db/schema";
import type { JobQueue } from "@/lib/jobs/types";
import type { Actor } from "./actor";
import { stageQueue } from "./investigations";

type Database = typeof defaultDb;

export async function refreshScan(
  actor: Actor,
  queue: JobQueue,
  database: Database = defaultDb,
  now = new Date(),
) {
  if (actor.type !== "worker" && actor.type !== "system") throw new Error("Worker access required.");
  await purgeExpiredProviderCache(database, now);
  const refreshAfter = Number(process.env.REFRESH_AFTER_DAYS ?? 180);
  const warningDays = Number(process.env.CERT_EXPIRY_WARNING_DAYS ?? 30);
  const minimumIntervalDays = Number(process.env.REFRESH_MIN_INTERVAL_DAYS ?? 7);
  const staleDate = new Date(now.getTime() - refreshAfter * 86400_000);
  const minimumIntervalDate = new Date(now.getTime() - minimumIntervalDays * 86400_000);
  const warningDate = new Date(now.getTime() + warningDays * 86400_000).toISOString().slice(0, 10);
  const publishedBranches = await database
    .select({ id: branches.id, lastConfirmedAt: branches.lastConfirmedAt })
    .from(branches)
    .where(inArray(branches.researchStatus, ["findings_published", "needs_refresh"]));
  const expiring = await database
    .select({ branchId: certificates.branchId })
    .from(certificates)
    .where(
      and(
        eq(certificates.reviewStatus, "accepted"),
        isNotNull(certificates.branchId),
        lte(certificates.validUntil, warningDate),
      ),
    );
  const changedCorrections = await database
    .select({ branchId: corrections.branchId })
    .from(corrections)
    .where(and(eq(corrections.status, "accepted"), isNotNull(corrections.branchId)));
  const candidates = new Set([
    ...publishedBranches
      .filter((branch) => !branch.lastConfirmedAt || branch.lastConfirmedAt < staleDate)
      .map((branch) => branch.id),
    ...expiring.map((certificate) => certificate.branchId).filter((id): id is string => id !== null),
    ...changedCorrections.map((correction) => correction.branchId),
  ]);
  let queued = 0;
  for (const branchId of candidates) {
    const recentFinished = await database
      .select({ id: investigations.id })
      .from(investigations)
      .where(
        and(
          eq(investigations.branchId, branchId),
          eq(investigations.isActive, false),
          gte(investigations.updatedAt, minimumIntervalDate),
        ),
      )
      .limit(1);
    if (recentFinished.length) continue;
    const [created] = await database
      .insert(investigations)
      .values({
        branchId,
        kind: "refresh",
        status: "queued",
        isActive: true,
      })
      .onConflictDoNothing({
        target: investigations.branchId,
        where: eq(investigations.isActive, true),
      })
      .returning({ id: investigations.id });
    if (!created) continue;
    await database
      .update(corrections)
      .set({ status: "converted", updatedAt: now })
      .where(and(eq(corrections.branchId, branchId), eq(corrections.status, "accepted")));
    await database
      .update(branches)
      .set({ researchStatus: "needs_refresh", updatedAt: now })
      .where(eq(branches.id, branchId));
    await queue.enqueue(
      "investigation.public_research",
      { investigationId: created.id },
      { singletonKey: `public_research:${created.id}` },
    );
    queued++;
  }
  return queued;
}

export async function purgeExpiredProviderCache(
  database: Database = defaultDb,
  now = new Date(),
) {
  const expiry = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const removed = await database
    .update(branches)
    .set({ providerName: null, providerAddress: null, providerCachedAt: null, updatedAt: now })
    .where(and(isNotNull(branches.providerCachedAt), lt(branches.providerCachedAt, expiry)))
    .returning({ id: branches.id });
  return removed.length;
}

export async function reconcileInvestigations(
  actor: Actor,
  queue: JobQueue,
  database: Database = defaultDb,
) {
  if (actor.type !== "worker" && actor.type !== "system") throw new Error("Worker access required.");
  const active = await database
    .select({
      id: investigations.id,
      status: investigations.status,
      paused: investigations.paused,
    })
    .from(investigations)
    .where(eq(investigations.isActive, true));
  let enqueued = 0;
  for (const investigation of active) {
    if (investigation.paused) continue;
    const queueName = stageQueue(investigation.status);
    if (!queueName) continue;
    const activeJob = await database
      .select({ id: jobRuns.id })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.investigationId, investigation.id),
          eq(jobRuns.jobName, queueName),
          inArray(jobRuns.status, ["queued", "running"]),
        ),
      )
      .limit(1);
    if (activeJob.length) continue;
    await queue.enqueue(queueName, { investigationId: investigation.id }, {
      singletonKey: `${queueName}:${investigation.id}`,
    });
    enqueued++;
  }
  return enqueued;
}
