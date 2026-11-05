import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  branchFollows,
  branches,
  certificates,
  corrections,
  externalPlaceIds,
  favorites,
  investigations,
  jobRuns,
} from "@/db/schema";
import type { JobQueue } from "@/lib/jobs/types";
import { getPlacesProvider } from "@/lib/providers/places";
import type { PlacesProvider } from "@/lib/providers/places";
import { consumeGoogleDetailsLimit } from "@/lib/providers/places/limits";
import { writeAudit } from "@/lib/domain/audit";
import { waitingForBusinessDetails } from "@/lib/domain/admin";
import type { Actor } from "./actor";
import { stageQueue, stageSingletonKey } from "./investigations";

type Database = typeof defaultDb;

export async function refreshScan(
  actor: Actor,
  queue: JobQueue,
  database: Database = defaultDb,
  now = new Date(),
) {
  if (actor.type !== "worker" && actor.type !== "system")
    throw new Error("Worker access required.");
  await purgeExpiredProviderCache(database, now);
  const refreshAfter = Number(process.env.REFRESH_AFTER_DAYS ?? 180);
  const warningDays = Number(process.env.CERT_EXPIRY_WARNING_DAYS ?? 30);
  const minimumIntervalDays = Number(
    process.env.REFRESH_MIN_INTERVAL_DAYS ?? 7,
  );
  const staleDate = new Date(now.getTime() - refreshAfter * 86400_000);
  const minimumIntervalDate = new Date(
    now.getTime() - minimumIntervalDays * 86400_000,
  );
  const warningDate = new Date(now.getTime() + warningDays * 86400_000)
    .toISOString()
    .slice(0, 10);
  const publishedBranches = await database
    .select({ id: branches.id, lastConfirmedAt: branches.lastConfirmedAt })
    .from(branches)
    .where(
      inArray(branches.researchStatus, ["findings_published", "needs_refresh"]),
    );
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
    .where(
      and(eq(corrections.status, "accepted"), isNotNull(corrections.branchId)),
    );
  const candidates = new Set([
    ...publishedBranches
      .filter(
        (branch) =>
          !branch.lastConfirmedAt || branch.lastConfirmedAt < staleDate,
      )
      .map((branch) => branch.id),
    ...expiring
      .map((certificate) => certificate.branchId)
      .filter((id): id is string => id !== null),
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
      .where(
        and(
          eq(corrections.branchId, branchId),
          eq(corrections.status, "accepted"),
        ),
      );
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
  provider: PlacesProvider = getPlacesProvider(),
) {
  const expiry = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const staleBranches = await database
    .select({
      id: branches.id,
      detailsSource: branches.detailsSource,
      provider: externalPlaceIds.provider,
      externalId: externalPlaceIds.externalId,
      hasUserState: sql<boolean>`(
        EXISTS (SELECT 1 FROM ${investigations} WHERE ${investigations.branchId} = ${branches.id})
        OR EXISTS (SELECT 1 FROM ${branchFollows} WHERE ${branchFollows.branchId} = ${branches.id})
        OR EXISTS (SELECT 1 FROM ${favorites} WHERE ${favorites.branchId} = ${branches.id})
      )`,
    })
    .from(branches)
    .leftJoin(externalPlaceIds, eq(externalPlaceIds.branchId, branches.id))
    .where(
      or(
        and(
          eq(branches.detailsSource, "provider"),
          isNull(branches.providerCachedAt),
        ),
        lt(branches.providerCachedAt, expiry),
      ),
    );
  let removed = 0;
  for (const branch of staleBranches) {
    if (
      branch.detailsSource === "provider" &&
      !branch.hasUserState
    ) {
      await database.delete(branches).where(eq(branches.id, branch.id));
      removed++;
      continue;
    }
    try {
      if (!branch.externalId) throw new Error("Provider place ID missing.");
      if (
        branch.provider === "google" &&
        !(await consumeGoogleDetailsLimit(database, "public", now))
      ) {
        break;
      }
      const details = await provider.getPlace(branch.externalId, "summary");
      if (!details) throw new Error("Provider place details unavailable.");
      await database
        .update(branches)
        .set({
          lat: details.location.latitude,
          lng: details.location.longitude,
          providerCachedAt: now,
          updatedAt: now,
        })
        .where(eq(branches.id, branch.id));
    } catch {
      await database
        .update(branches)
        .set({ lat: 0, lng: 0, providerCachedAt: null, updatedAt: now })
        .where(eq(branches.id, branch.id));
      console.warn(
        `Provider place cache refresh failed for branch ${branch.id}; stale coordinates cleared.`,
      );
    }
  }
  return removed;
}

export async function reconcileInvestigations(
  actor: Actor,
  queue: JobQueue,
  database: Database = defaultDb,
  now = new Date(),
) {
  if (actor.type !== "worker" && actor.type !== "system")
    throw new Error("Worker access required.");
  await database
    .update(jobRuns)
    .set({
      status: "failed",
      lastError: "Stale run: worker did not finish.",
      finishedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        isNotNull(jobRuns.singletonKey),
        inArray(jobRuns.status, ["queued", "running"]),
        lt(jobRuns.updatedAt, new Date(now.getTime() - 30 * 60_000)),
      ),
    );
  const active = await database
    .select({
      id: investigations.id,
      status: investigations.status,
      paused: investigations.paused,
      stageDetail: investigations.stageDetail,
    })
    .from(investigations)
    .where(eq(investigations.isActive, true));
  let enqueued = 0;
  for (const investigation of active) {
    if (investigation.paused) {
      if (investigation.stageDetail !== waitingForBusinessDetails) continue;
      const resumed = await database.transaction(async (tx) => {
        const [row] = await tx
          .update(investigations)
          .set({ paused: false, updatedAt: now })
          .where(
            and(
              eq(investigations.id, investigation.id),
              eq(investigations.isActive, true),
              eq(investigations.paused, true),
              eq(investigations.stageDetail, waitingForBusinessDetails),
            ),
          )
          .returning({ id: investigations.id });
        if (!row) return false;
        await writeAudit(tx, {
          actorType: actor.type,
          action: "investigation_auto_resumed",
          entityType: "investigation",
          entityId: row.id,
        });
        return true;
      });
      if (!resumed) continue;
      await queue.enqueue(
        "investigation.public_research",
        { investigationId: investigation.id },
        { singletonKey: `public_research:${investigation.id}` },
      );
      enqueued++;
      continue;
    }
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
    const recentFailures = await database
      .select({ id: jobRuns.id })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.investigationId, investigation.id),
          eq(jobRuns.jobName, queueName),
          eq(jobRuns.status, "failed"),
          gte(
            jobRuns.updatedAt,
            new Date(now.getTime() - 24 * 60 * 60 * 1000),
          ),
        ),
      )
      .limit(3);
    if (recentFailures.length >= 3) continue;
    await queue.enqueue(
      queueName,
      { investigationId: investigation.id },
      {
        singletonKey: stageSingletonKey(queueName, investigation.id),
      },
    );
    enqueued++;
  }
  return enqueued;
}
