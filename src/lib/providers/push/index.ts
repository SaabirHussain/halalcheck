import { db as defaultDb } from "@/db";
import { DemoPushProvider } from "./demo";
import type { PushProvider } from "./types";
import { UnconfiguredPushProvider } from "./unconfigured";

export function getPushProvider(
  database: typeof defaultDb = defaultDb,
): PushProvider {
  const selected = process.env.PUSH_PROVIDER ?? "demo";
  if (selected === "demo") return new DemoPushProvider(database);
  if (selected === "fcm-apns") return new UnconfiguredPushProvider();
  throw new Error("Unsupported push provider.");
}

export type { PushMessage, PushProvider } from "./types";
