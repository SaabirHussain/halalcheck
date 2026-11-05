import { z } from "zod";
import { claimAttributeEnum, claimProductEnum } from "@/db/schema";

export const claimSchema = z.object({
  product: z.enum(claimProductEnum.enumValues),
  attribute: z.enum(claimAttributeEnum.enumValues),
  value: z.string().min(1).max(500),
  valueEnum: z.string().max(80).nullable().default(null),
  evidenceCategory: z.enum([
    "public_website",
    "certification",
    "supplier_statement",
  ]),
  confirmedAt: z.string().date().nullable().default(null),
  excerpt: z.string().min(1).max(1000),
});

export const replySchema = z.object({
  answers: z.array(
    z.object({
      questionKey: z.string().min(1),
      product: z.enum(claimProductEnum.enumValues),
      attribute: z.enum(claimAttributeEnum.enumValues),
      value: z.string().min(1).max(500),
      valueEnum: z.string().max(80).nullable().default(null),
      specificity: z.enum(["specific", "vague", "unknown"]),
      excerpt: z.string().min(1).max(1000),
    }),
  ),
  optOut: z.boolean().default(false),
  refusal: z.boolean().default(false),
  staffDontKnow: z.boolean().default(false),
  vagueSignals: z
    .array(
      z.enum([
        "general_halal_claim",
        "certified_no_org",
        "staff_dont_know",
        "referral",
      ]),
    )
    .default([]),
  referral: z
    .object({ name: z.string().max(200), email: z.string().email().max(320) })
    .nullable()
    .default(null),
});
