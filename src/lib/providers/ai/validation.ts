import { z } from "zod";
import { claimAttributeEnum, claimProductEnum } from "@/db/schema";

export const claimEvidenceCategoryEnum = z.enum([
  "public_website",
  "certification",
  "supplier_statement",
]);

export const replySpecificityEnum = z.enum(["specific", "vague", "unknown"]);

export const replyVagueSignalEnum = z.enum([
  "general_halal_claim",
  "certified_no_org",
  "staff_dont_know",
  "referral",
]);

export const claimSchema = z.object({
  product: z.enum(claimProductEnum.enumValues),
  attribute: z.enum(claimAttributeEnum.enumValues),
  value: z.string().min(1).max(500),
  valueEnum: z.string().max(80).nullable().default(null),
  evidenceCategory: claimEvidenceCategoryEnum,
  confirmedAt: z.string().date().nullable().default(null),
  excerpt: z.string().min(1).max(1000),
});

export const replyAnswerSchema = z.object({
  questionKey: z.string().min(1),
  product: z.enum(claimProductEnum.enumValues),
  attribute: z.enum(claimAttributeEnum.enumValues),
  value: z.string().min(1).max(500),
  valueEnum: z.string().max(80).nullable().default(null),
  specificity: replySpecificityEnum,
  excerpt: z.string().min(1).max(1000),
});

export const replySchema = z.object({
  answers: z.array(replyAnswerSchema),
  optOut: z.boolean().default(false),
  refusal: z.boolean().default(false),
  staffDontKnow: z.boolean().default(false),
  vagueSignals: z.array(replyVagueSignalEnum).default([]),
  referral: z
    .object({ name: z.string().max(200), email: z.string().email().max(320) })
    .nullable()
    .default(null),
});

export const businessLocationSchema = z
  .object({
    address: z.string().trim().min(1).max(500).nullable(),
    city: z.string().trim().min(1).max(200).nullable(),
    phone: z.string().trim().min(1).max(100).nullable().optional(),
    addressExcerpt: z.string().trim().min(1).max(1000).nullable(),
  })
  .strict();

export const businessDetailsSchema = z
  .object({
    name: z.string().trim().min(1).max(200).nullable(),
    nameExcerpt: z.string().trim().min(1).max(1000).nullable(),
    locations: z.array(z.unknown()).max(50),
  })
  .strict();
