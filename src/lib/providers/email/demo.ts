import { db as defaultDb } from "@/db";
import { emailOutbox } from "@/db/schema";
import type { EmailMessage, EmailProvider } from "./types";

export class DemoEmailProvider implements EmailProvider {
  constructor(private readonly database: typeof defaultDb = defaultDb) {}

  async send(message: EmailMessage) {
    const [row] = await this.database
      .insert(emailOutbox)
      .values({
        to: message.to,
        from: message.from,
        subject: message.subject,
        bodyText: message.bodyText,
        headers: message.headers,
        purpose: message.purpose,
        status: "captured",
        relatedMessageId: message.relatedMessageId,
      })
      .returning({ id: emailOutbox.id });
    return { providerMessageId: `demo:${row!.id}`, captured: true };
  }
}
