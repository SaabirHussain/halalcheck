import { db as defaultDb } from "@/db";
import { consumeRateLimit } from "@/lib/domain/rate-limit";

type Database = typeof defaultDb;

const dayWindowMs = 24 * 60 * 60 * 1000;

function configuredLimit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
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
  now = new Date(),
) {
  const daily = await consumeRateLimit(
    database,
    `google:details:${now.toISOString().slice(0, 10)}`,
    configuredLimit("GOOGLE_PLACES_DETAILS_DAILY_LIMIT", 150),
    dayWindowMs,
    now,
  );
  return daily.allowed;
}
