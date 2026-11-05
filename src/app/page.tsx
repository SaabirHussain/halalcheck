import { DiscoveryExplorer } from "@/components/discovery/DiscoveryExplorer";
import type { DiscoveryFilterState } from "@/components/discovery/filter-types";
import { listPublicBranches } from "@/lib/domain/public";
import {
  businessCategories,
  researchStatuses,
  type BusinessCategory,
  type ResearchStatus,
} from "@/lib/shared/types";

type SearchParams = Record<string, string | string[] | undefined>;

function getValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getNumber(value: string | undefined) {
  if (value === undefined || value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const category = getValue(params, "category");
  const status = getValue(params, "status");
  const certified = getValue(params, "certified");
  const menu = getValue(params, "menu");
  const slaughter = getValue(params, "slaughter");
  const lat = getNumber(getValue(params, "lat"));
  const lng = getNumber(getValue(params, "lng"));
  const radiusKm = getNumber(getValue(params, "radiusKm"));

  const initialFilters: DiscoveryFilterState = {
    q: getValue(params, "q") ?? "",
    category: businessCategories.includes(category as BusinessCategory)
      ? (category as BusinessCategory)
      : undefined,
    status: researchStatuses.includes(status as ResearchStatus)
      ? (status as ResearchStatus)
      : undefined,
    slaughter:
      slaughter === "hand" || slaughter === "machine" || slaughter === "mixed"
        ? slaughter
        : undefined,
    certified:
      certified === "true" || certified === "false" ? certified : undefined,
    menu: menu === "full" || menu === "partial" ? menu : undefined,
    radiusKm: radiusKm && [2, 5, 10, 25].includes(radiusKm) ? radiusKm : 25,
    lat: lat !== undefined && lng !== undefined ? lat : undefined,
    lng: lat !== undefined && lng !== undefined ? lng : undefined,
    area: getValue(params, "area")?.slice(0, 100) ?? "Demo City",
  };
  const places = await listPublicBranches({
    ...initialFilters,
    category: initialFilters.category,
    status: initialFilters.status,
    certified:
      initialFilters.certified === undefined
        ? undefined
        : initialFilters.certified === "true",
  });

  return <DiscoveryExplorer initialFilters={initialFilters} places={places} />;
}
