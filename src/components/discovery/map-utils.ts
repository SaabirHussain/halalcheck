import type { DiscoveryPlace } from "./PlaceCard";

export function markerColor(status: DiscoveryPlace["researchStatus"]) {
  if (status === "findings_published") return "#1F5C3F";
  if (status === "needs_refresh" || status === "unable_to_confirm")
    return "#B45309";
  if (status === "not_researched") return "#6B665D";
  return "#1D4E89";
}
