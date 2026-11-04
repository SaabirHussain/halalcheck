import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { schema } from "./schema";

export function createDatabase(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is required");
  const client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => undefined,
  });
  return { client, db: drizzle(client, { schema }) };
}

const database = createDatabase();
export const sql = database.client;
export const db = database.db;
