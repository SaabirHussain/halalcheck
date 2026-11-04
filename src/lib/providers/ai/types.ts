import type { z } from "zod";
import type { claimAttributeEnum, claimProductEnum } from "@/db/schema";
import { claimSchema, replySchema } from "./validation";

export type PublicClaim = z.infer<typeof claimSchema>;
export type ParsedReply = z.infer<typeof replySchema>;
export type OpenQuestion = { key: string; prompt: string; product?: string; attribute?: string };

export interface AIProvider {
  extractPublicClaims(pages: Array<{ url: string; title: string; text: string }>): Promise<PublicClaim[]>;
  parseReply(text: string, openQuestions: OpenQuestion[]): Promise<ParsedReply>;
}

export type ClaimProduct = (typeof claimProductEnum.enumValues)[number];
export type ClaimAttribute = (typeof claimAttributeEnum.enumValues)[number];
