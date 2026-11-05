import postgres from "postgres";

export const workerLockKeys = [1212238915, 1212367665] as const;

export async function isWorkerRunning(
  connectionString = process.env.DATABASE_URL,
) {
  if (!connectionString)
    throw new Error("DATABASE_URL is required to check worker status.");

  const client = postgres(connectionString, {
    max: 1,
    connect_timeout: 10,
  });

  try {
    const [lock] = await client`
      select pg_try_advisory_lock(${workerLockKeys[0]}, ${workerLockKeys[1]}) as acquired
    `;
    if (!lock.acquired) return true;

    await client`
      select pg_advisory_unlock(${workerLockKeys[0]}, ${workerLockKeys[1]})
    `;
    return false;
  } finally {
    await client.end({ timeout: 5 });
  }
}
