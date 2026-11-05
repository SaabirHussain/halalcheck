import { db as defaultDb } from "@/db";
import { notificationPushes } from "@/db/schema";
import type { PushMessage, PushProvider } from "./types";

export class DemoPushProvider implements PushProvider {
  constructor(private readonly database: typeof defaultDb = defaultDb) {}

  async send(message: PushMessage) {
    await this.database
      .insert(notificationPushes)
      .values({
        notificationId: message.notificationId,
        deviceId: message.deviceId,
        status: "captured",
      })
      .onConflictDoNothing();
  }
}
