import type { PushProvider } from "./types";

export class UnconfiguredPushProvider implements PushProvider {
  async send(): Promise<void> {
    throw new Error("FCM/APNs push delivery is not configured.");
  }
}
