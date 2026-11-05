import type { EmailMessage, EmailProvider } from "./types";

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly apiBase = "https://api.resend.com",
  ) {}

  async send(message: EmailMessage) {
    if (
      process.env.EMAIL_PROVIDER !== "resend" ||
      process.env.OUTREACH_ALLOW_REAL_SEND !== "true"
    ) {
      throw new Error(
        "Resend delivery is disabled; explicit real-send flag required.",
      );
    }
    const replyToEntry = Object.entries(message.headers).find(
      ([name]) => name.toLowerCase() === "reply-to",
    );
    const headers = Object.fromEntries(
      Object.entries(message.headers).filter(
        ([name]) => name.toLowerCase() !== "reply-to",
      ),
    );
    const response = await fetch(
      `${this.apiBase.replace(/\/$/, "")}/emails`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(message.relatedMessageId
            ? { "Idempotency-Key": message.relatedMessageId }
            : {}),
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          text: message.bodyText,
          ...(replyToEntry ? { reply_to: replyToEntry[1] } : {}),
          headers,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok)
      throw new Error(`Resend send failed with status ${response.status}.`);
    const data = (await response.json()) as { id?: string };
    if (!data.id) throw new Error("Resend send response did not include an id.");
    return { providerMessageId: data.id, captured: false };
  }
}
