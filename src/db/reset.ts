import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (process.env.DEMO_MODE !== "true") {
  throw new Error("db:reset is limited to DEMO_MODE=true.");
}
let localUrl: URL | undefined;
try {
  if (url) localUrl = new URL(url);
} catch {
  localUrl = undefined;
}
if (
  !url ||
  !localUrl ||
  !["localhost", "127.0.0.1", "::1"].includes(localUrl.hostname) ||
  !/\/halalcheck(?:\?|$)/.test(url)
) {
  throw new Error("db:reset only permits the local halalcheck database.");
}
const client = postgres(url, { max: 1 });
try {
  await client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE;");
  await client.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.unsafe(
    "GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;",
  );
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.info("Demo database reset and migrations applied.");
} finally {
  await client.end();
}
