import { sql } from "drizzle-orm";
import { rateLimits } from "@/db/schema";

type RateDatabase = {
  insert: (table: typeof rateLimits) => {
    values: (values: { key: string; windowStart: Date; count: number }) => {
      onConflictDoUpdate: (config: {
        target: [typeof rateLimits.key, typeof rateLimits.windowStart];
        set: { count: ReturnType<typeof sql> };
      }) => {
        returning: (selection: { count: typeof rateLimits.count }) => Promise<Array<{ count: number }>>;
      };
    };
  };
};

export async function consumeRateLimit(
  database: RateDatabase,
  key: string,
  limit: number,
  windowMs: number,
  now = new Date(),
) {
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const [record] = await database
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  return { allowed: (record?.count ?? limit + 1) <= limit, count: record?.count ?? limit + 1 };
}
