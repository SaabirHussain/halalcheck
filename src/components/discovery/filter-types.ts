import type { BusinessCategory, ResearchStatus } from "@/lib/shared/types";

export type DiscoveryFilterState = {
  q: string;
  category?: BusinessCategory;
  status?: ResearchStatus;
  slaughter?: "hand" | "machine" | "mixed";
  certified?: "true" | "false";
  menu?: "full" | "partial";
  radiusKm: number;
  lat?: number;
  lng?: number;
  area: string;
};

export const defaultDiscoveryFilters: DiscoveryFilterState = {
  q: "",
  radiusKm: 25,
  area: "Demo City",
};
