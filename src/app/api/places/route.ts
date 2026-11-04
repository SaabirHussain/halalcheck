import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { branches, businesses, externalPlaceIds } from "@/db/schema";
import { listPublicBranches } from "@/lib/domain/public";
import { purgeExpiredProviderCache } from "@/lib/domain/refresh";
import { getPlacesProvider } from "@/lib/providers/places";
import type { PlaceResult } from "@/lib/providers/places";
import { businessCategories, researchStatuses } from "@/lib/shared/types";

const numberValue = z.coerce.number().finite();
const querySchema = z.object({
  lat: numberValue.min(-90).max(90).optional(),
  lng: numberValue.min(-180).max(180).optional(),
  radiusKm: numberValue.min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  category: z.enum(businessCategories).optional(),
  status: z.enum(researchStatuses).optional(),
  slaughter: z.enum(["hand", "machine", "unknown"]).optional(),
  certified: z.enum(["true", "false"]).optional(),
  menu: z.enum(["full", "partial"]).optional(),
});

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    lat: searchParams.get("lat") ?? undefined,
    lng: searchParams.get("lng") ?? undefined,
    radiusKm: searchParams.get("radiusKm") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    slaughter: searchParams.get("slaughter") ?? undefined,
    certified: searchParams.get("certified") ?? undefined,
    menu: searchParams.get("menu") ?? undefined,
  });
  if (!parsed.success || (parsed.data.lat == null) !== (parsed.data.lng == null)) {
    return NextResponse.json({ error: "Invalid discovery filters." }, { status: 400 });
  }

  const filters = {
    ...parsed.data,
    certified: parsed.data.certified === undefined ? undefined : parsed.data.certified === "true",
  };

  try {
    if (filters.lat != null && filters.lng != null) {
      await purgeExpiredProviderCache(db);
      const placeResults = await getPlacesProvider().searchNearby({
        lat: filters.lat,
        lng: filters.lng,
        radiusKm: filters.radiusKm,
        category: filters.category,
        query: filters.q,
      });
      for (const place of placeResults) await cachePlace(place);
    }
    const results = await listPublicBranches(filters, db);
    return NextResponse.json({
      results,
      attribution: process.env.PLACES_PROVIDER === "google" ? "Powered by Google" : "Demo places data",
    });
  } catch {
    return NextResponse.json({ error: "Place discovery is temporarily unavailable." }, { status: 502 });
  }
}

async function cachePlace(place: PlaceResult) {
  const existing = await db
    .select({ branchId: externalPlaceIds.branchId, businessId: branches.businessId })
    .from(externalPlaceIds)
    .innerJoin(branches, eq(externalPlaceIds.branchId, branches.id))
    .where(and(eq(externalPlaceIds.provider, place.provider), eq(externalPlaceIds.externalId, place.externalId)))
    .limit(1);
  if (existing[0]) {
    await db
      .update(branches)
      .set({
        providerName: place.name,
        providerAddress: place.address,
        providerCachedAt: new Date(),
        lat: place.lat,
        lng: place.lng,
        updatedAt: new Date(),
      })
      .where(eq(branches.id, existing[0].branchId));
    return;
  }

  const businessId = randomUUID();
  const branchId = randomUUID();
  await db.insert(businesses).values({
    id: businessId,
    name: "Nearby business",
    category: place.category,
    website: null,
    isDemo: place.provider === "demo",
  }).onConflictDoNothing();
  await db.insert(branches).values({
    id: branchId,
    businessId,
    name: "Nearby",
    address: "Address not available",
    city: "Nearby",
    lat: place.lat,
    lng: place.lng,
    phone: null,
    website: null,
    timezone: "UTC",
    researchStatus: "not_researched",
    providerName: place.name,
    providerAddress: place.address,
    providerCachedAt: new Date(),
    isDemo: place.provider === "demo",
  }).onConflictDoNothing();
  await db.insert(externalPlaceIds).values({
    branchId,
    provider: place.provider,
    externalId: place.externalId,
  }).onConflictDoNothing();
}
