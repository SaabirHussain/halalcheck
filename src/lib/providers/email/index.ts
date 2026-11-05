import { DemoEmailProvider } from "./demo";
import { MailgunEmailProvider } from "./mailgun";
import { db as defaultDb } from "@/db";
import type { EmailProvider } from "./types";

let warned = false;

export function getEmailProvider(
  database: typeof defaultDb = defaultDb,
): EmailProvider {
  if (
    process.env.EMAIL_PROVIDER === "mailgun" &&
    process.env.MAILGUN_API_KEY &&
    process.env.MAILGUN_DOMAIN
  ) {
    return new MailgunEmailProvider(
      process.env.MAILGUN_API_KEY,
      process.env.MAILGUN_DOMAIN,
      process.env.MAILGUN_API_BASE,
    );
  }
  if (process.env.EMAIL_PROVIDER === "mailgun" && !warned) {
    warned = true;
    console.warn(
      "Mailgun selected without credentials; using captured demo email.",
    );
  }
  return new DemoEmailProvider(database);
}

export type { EmailProvider, EmailMessage } from "./types";
