import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  branches,
  businesses,
  externalPlaceIds,
} from "@/db/schema";
import type { PublicDiscoveryFilters } from "@/lib/domain/public";
import { getPlacesProvider } from "@/lib/providers/places";
import type { PlaceResult, PlacesProvider } from "@/lib/providers/places";
import { consumeGoogleSearchLimits } from "@/lib/providers/places/limits";

type Database = typeof defaultDb;

export type ProviderPlaceOverlay = Map<string, PlaceResult>;

export type ProviderSearchResult = {
  filters: PublicDiscoveryFilters;
  overlay: ProviderPlaceOverlay;
  notice?: string;
};

function defaultCenter() {
  const [lat, lng] = (
    process.env.DISCOVERY_DEFAULT_CENTER ?? "43.6532,-79.3832"
  ).split(",");
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return { lat: latitude, lng: longitude };
  }
  return { lat: 43.6532, lng: -79.3832 };
}

export async function searchAndCacheProviderPlaces(
  filters: PublicDiscoveryFilters,
  clientIp: string,
  database: Database = defaultDb,
  now = new Date(),
  provider: PlacesProvider = getPlacesProvider(),
  allowProvider = true,
): Promise<ProviderSearchResult> {
  const effectiveFilters = { ...filters };
  if (
    process.env.PLACES_PROVIDER === "google" &&
    (effectiveFilters.lat == null || effectiveFilters.lng == null)
  ) {
    const center = defaultCenter();
    effectiveFilters.lat = center.lat;
    effectiveFilters.lng = center.lng;
  }

  const overlay: ProviderPlaceOverlay = new Map();
  if (!allowProvider) return { filters: effectiveFilters, overlay };
  if (effectiveFilters.lat == null || effectiveFilters.lng == null) {
    return { filters: effectiveFilters, overlay };
  }

  if (
    process.env.PLACES_PROVIDER === "google" &&
    process.env.GOOGLE_PLACES_API_KEY &&
    !(await consumeGoogleSearchLimits(database, clientIp, now))
  ) {
    return {
      filters: effectiveFilters,
      overlay,
      notice: "Google Places search limit reached. Showing first-party places only.",
    };
  }

  let places: PlaceResult[];
  try {
    places = await provider.searchNearby({
      lat: effectiveFilters.lat,
      lng: effectiveFilters.lng,
      radiusKm: effectiveFilters.radiusKm ?? 20,
      category: effectiveFilters.category,
      query: effectiveFilters.q,
    });
  } catch (error) {
    console.error("Google Places search failed:", error);
    return {
      filters: effectiveFilters,
      overlay,
      notice:
        "Google Places search is temporarily unavailable. Showing reviewed places only.",
    };
  }
  for (const place of places) {
    const saved = await cacheProviderPlace(place, database, now);
    if (saved.detailsSource === "provider") {
      overlay.set(saved.branchId, place);
    }
  }
  return { filters: effectiveFilters, overlay };
}

async function cacheProviderPlace(
  place: PlaceResult,
  database: Database,
  now: Date,
) {
  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        branchId: externalPlaceIds.branchId,
        detailsSource: branches.detailsSource,
      })
      .from(externalPlaceIds)
      .innerJoin(branches, eq(externalPlaceIds.branchId, branches.id))
      .where(
        and(
          eq(externalPlaceIds.provider, place.provider),
          eq(externalPlaceIds.externalId, place.externalId),
        ),
      )
      .limit(1);
    if (existing) {
      if (existing.detailsSource === "provider") {
        await tx
          .update(branches)
          .set({
            lat: place.lat,
            lng: place.lng,
            providerCachedAt: now,
            updatedAt: now,
          })
          .where(eq(branches.id, existing.branchId));
      }
      return existing;
    }

    const businessId = randomUUID();
    const branchId = randomUUID();
    await tx.insert(businesses).values({
      id: businessId,
      name: "",
      category: place.category,
      website: null,
      isDemo: place.provider === "demo",
    });
    await tx.insert(branches).values({
      id: branchId,
      businessId,
      name: "",
      address: "",
      city: "",
      lat: place.lat,
      lng: place.lng,
      phone: null,
      website: null,
      researchStatus: "not_researched",
      providerCachedAt: now,
      detailsSource: "provider",
      isDemo: place.provider === "demo",
    });
    await tx.insert(externalPlaceIds).values({
      branchId,
      provider: place.provider,
      externalId: place.externalId,
    });
    return { branchId, detailsSource: "provider" as const };
  });
}
