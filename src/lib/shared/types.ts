export type BusinessCategory = "restaurant" | "butcher" | "grocery";
export const businessCategories = ["restaurant", "butcher", "grocery"] as const;

export const researchStatuses = [
  "not_researched",
  "queued",
  "checking_public_sources",
  "awaiting_outreach_approval",
  "awaiting_business_response",
  "reviewing_evidence",
  "findings_published",
  "unable_to_confirm",
  "needs_refresh",
] as const;

export type ResearchStatus = (typeof researchStatuses)[number];
