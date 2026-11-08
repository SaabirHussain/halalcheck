import { db as defaultDb } from "@/db";
import { consumeRateLimit } from "@/lib/domain/rate-limit";

type Database = typeof defaultDb;

const dayWindowMs = 24 * 60 * 60 * 1000;

function configuredLimit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function configuredReserve(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && Number.isInteger(value) ? value : fallback;
}

export async function consumeGoogleSearchLimits(
  database: Database,
  ip: string,
  now = new Date(),
) {
  const perIp = await consumeRateLimit(
    database,
    `google:search:ip:${ip}`,
    60,
    60 * 60 * 1000,
    now,
  );
  if (!perIp.allowed) return false;
  const daily = await consumeRateLimit(
    database,
    `google:search:${now.toISOString().slice(0, 10)}`,
    configuredLimit("GOOGLE_PLACES_SEARCH_DAILY_LIMIT", 150),
    dayWindowMs,
    now,
  );
  return daily.allowed;
}

export async function consumeGoogleDetailsLimit(
  database: Database,
  pool: "public" | "agent",
  now = new Date(),
) {
  const total = configuredLimit("GOOGLE_PLACES_DETAILS_DAILY_LIMIT", 150);
  const reserve = Math.max(
    0,
    Math.min(
      total,
      configuredReserve("GOOGLE_PLACES_AGENT_DETAILS_DAILY_RESERVE", 30),
    ),
  );
  const daily = await consumeRateLimit(
    database,
    `google:details:${pool}:${now.toISOString().slice(0, 10)}`,
    pool === "agent" ? reserve : total - reserve,
    dayWindowMs,
    now,
  );
  return daily.allowed;
}

export async function consumeGooglePhotoLimit(
  database: Database,
  ip: string,
  now = new Date(),
) {
  const perIp = await consumeRateLimit(
    database,
    `google:photo:ip:${ip}`,
    10,
    60 * 60 * 1000,
    now,
  );
  if (!perIp.allowed) return false;
  const daily = await consumeRateLimit(
    database,
    `google:photo:${now.toISOString().slice(0, 10)}`,
    configuredLimit("GOOGLE_PLACES_PHOTO_DAILY_LIMIT", 30),
    dayWindowMs,
    now,
  );
  return daily.allowed;
}
