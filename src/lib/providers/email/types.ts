export type EmailMessage = {
  to: string;
  from: string;
  subject: string;
  bodyText: string;
  headers: Record<string, string>;
  purpose: "outreach" | "notification";
  relatedMessageId?: string;
};

export interface EmailProvider {
  send(
    message: EmailMessage,
  ): Promise<{ providerMessageId: string; captured: boolean }>;
}
