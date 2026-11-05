import { headers } from "next/headers";
import { DiscoveryExplorer } from "@/components/discovery/DiscoveryExplorer";
import type { DiscoveryFilterState } from "@/components/discovery/filter-types";
import { listPublicBranches } from "@/lib/domain/public";
import { searchAndCacheProviderPlaces } from "@/lib/domain/provider-places";
import { getClientIp } from "@/lib/http/client-ip";
import { db } from "@/db";
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
  const providerSearch = await searchAndCacheProviderPlaces(
    {
      ...initialFilters,
      certified:
        initialFilters.certified === undefined
          ? undefined
          : initialFilters.certified === "true",
    },
    getClientIp(await headers()),
    db,
  );
  initialFilters.lat = providerSearch.filters.lat;
  initialFilters.lng = providerSearch.filters.lng;
  if (
    !getValue(params, "area") &&
    lat === undefined &&
    lng === undefined &&
    process.env.PLACES_PROVIDER === "google"
  ) {
    initialFilters.area = "Toronto";
  }
  const rows = await listPublicBranches(
    providerSearch.filters,
    db,
    new Set(providerSearch.overlay.keys()),
  );
  const places = rows.map((row) => {
    const livePlace = providerSearch.overlay.get(row.id);
    if (row.detailsSource !== "provider" || !livePlace) {
      return { ...row, attribution: false };
    }
    return {
      ...row,
      name: livePlace.name,
      address: livePlace.address,
      attribution: livePlace.provider === "google",
    };
  });

  return (
    <DiscoveryExplorer
      initialFilters={initialFilters}
      notice={providerSearch.notice}
      places={places}
    />
  );
}
