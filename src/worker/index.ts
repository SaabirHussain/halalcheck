import "dotenv/config";
import PgBoss from "pg-boss";
import postgres from "postgres";
import { db } from "@/db";
import { PgBossQueue } from "@/lib/jobs/pg-boss";
import { workerLockKeys } from "@/lib/jobs/worker-presence";
import { buildJobHandlers } from "./handlers";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required to start the worker.");

const workerLease = postgres(connectionString, {
  max: 1,
  idle_timeout: 0,
  max_lifetime: 0,
  connect_timeout: 10,
});
const [workerLock] = await workerLease`
  select pg_try_advisory_lock(${workerLockKeys[0]}, ${workerLockKeys[1]}) as acquired
`;
if (!workerLock.acquired) {
  await workerLease.end();
  throw new Error("Another HalalCheck worker is already running.");
}

const boss = new PgBoss({
  connectionString,
  retryLimit: 3,
  retryBackoff: true,
  application_name: "halalcheck-worker",
});
const queue = new PgBossQueue(boss);
const handlers = buildJobHandlers(db, queue);

await boss.start();
for (const [name, handler] of Object.entries(handlers)) {
  await queue.register(name, handler);
}
await boss.schedule(
  "investigations.reconcile",
  "*/2 * * * *",
  {},
  { singletonKey: "investigations.reconcile", tz: "UTC" },
);
await boss.schedule(
  "refresh.scan",
  "0 3 * * *",
  {},
  { singletonKey: "refresh.scan", tz: "UTC" },
);
console.info(
  `Worker ready; registered queues: ${Object.keys(handlers).join(", ")}`,
);
console.info(
  "Schedules registered: investigations.reconcile every 2m; refresh.scan daily at 03:00 UTC.",
);

const shutdown = async () => {
  await boss.stop({ graceful: true, timeout: 10_000 });
  await workerLease`
    select pg_advisory_unlock(${workerLockKeys[0]}, ${workerLockKeys[1]})
  `;
  await workerLease.end();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
