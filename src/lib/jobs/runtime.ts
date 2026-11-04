import PgBoss from "pg-boss";
import { PgBossQueue } from "./pg-boss";
import { InlineJobQueue } from "./memory";
import type { JobQueue } from "./types";

type Runtime = typeof globalThis & {
  __halalcheckPgBoss?: PgBoss;
  __halalcheckPgBossQueue?: PgBossQueue;
  __halalcheckPgBossStart?: Promise<void>;
  __halalcheckInlineQueue?: InlineJobQueue;
};

export async function getRuntimeQueue(): Promise<JobQueue> {
  if (process.env.QUEUE_DRIVER === "memory") {
    const runtime = globalThis as Runtime;
    runtime.__halalcheckInlineQueue ??= new InlineJobQueue();
    return runtime.__halalcheckInlineQueue;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the pg-boss queue.");
  const runtime = globalThis as Runtime;
  runtime.__halalcheckPgBoss ??= new PgBoss({
    connectionString,
    retryLimit: 3,
    retryBackoff: true,
    application_name: "halalcheck-web",
  });
  runtime.__halalcheckPgBossQueue ??= new PgBossQueue(runtime.__halalcheckPgBoss);
  runtime.__halalcheckPgBossStart ??= runtime.__halalcheckPgBoss.start().then(() => undefined);
  await runtime.__halalcheckPgBossStart;
  return runtime.__halalcheckPgBossQueue;
}
