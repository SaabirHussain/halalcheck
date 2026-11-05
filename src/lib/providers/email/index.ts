import { DemoEmailProvider } from "./demo";
import { MailgunEmailProvider } from "./mailgun";
import { ResendEmailProvider } from "./resend";
import { db as defaultDb } from "@/db";
import type { EmailProvider } from "./types";

const warnedProviders = new Set<string>();

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
  if (
    process.env.EMAIL_PROVIDER === "resend" &&
    process.env.RESEND_API_KEY
  ) {
    return new ResendEmailProvider(
      process.env.RESEND_API_KEY,
      process.env.RESEND_API_BASE,
    );
  }
  if (
    process.env.EMAIL_PROVIDER === "mailgun" &&
    !warnedProviders.has("mailgun")
  ) {
    warnedProviders.add("mailgun");
    console.warn(
      "Mailgun selected without credentials; using captured demo email.",
    );
  }
  if (
    process.env.EMAIL_PROVIDER === "resend" &&
    !warnedProviders.has("resend")
  ) {
    warnedProviders.add("resend");
    console.warn(
      "Resend selected without credentials; using captured demo email.",
    );
  }
  return new DemoEmailProvider(database);
}

export type { EmailProvider, EmailMessage } from "./types";
