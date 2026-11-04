import type { PhoneOutreachProvider } from "./types";

export class NotImplementedPhoneProvider implements PhoneOutreachProvider {
  async placeCall(): Promise<never> {
    throw new Error("Phone outreach is not available.");
  }
}
