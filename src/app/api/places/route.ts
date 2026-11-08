import { NextResponse } from "next/server";
import { db } from "@/db";
import { listPublicBranches } from "@/lib/domain/public";
import { searchAndCacheProviderPlaces } from "@/lib/domain/provider-places";
import { allowProviderSearch } from "@/lib/http/browser-gate";
import { getClientIp } from "@/lib/http/client-ip";
import { businessCategories, researchStatuses } from "@/lib/shared/types";
import { z } from "zod";

const numberValue = z.coerce.number().finite();
const querySchema = z.object({
  lat: numberValue.min(-90).max(90).optional(),
  lng: numberValue.min(-180).max(180).optional(),
  radiusKm: numberValue.min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  category: z.enum(businessCategories).optional(),
  status: z.enum(researchStatuses).optional(),
  slaughter: z.enum(["hand", "machine", "mixed", "unknown"]).optional(),
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
  if (
    !parsed.success ||
    (parsed.data.lat == null) !== (parsed.data.lng == null)
  ) {
    return NextResponse.json(
      { error: "Invalid discovery filters." },
      { status: 400 },
    );
  }

  const filters = {
    ...parsed.data,
    certified:
      parsed.data.certified === undefined
        ? undefined
        : parsed.data.certified === "true",
  };

  try {
    const providerSearch = await searchAndCacheProviderPlaces(
      filters,
      getClientIp(request.headers),
      db,
      undefined,
      undefined,
      allowProviderSearch(request.headers),
    );
    const rows = await listPublicBranches(
      providerSearch.filters,
      db,
      new Set(providerSearch.overlay.keys()),
    );
    const results = rows.map((row) => {
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
    return NextResponse.json({
      results,
      ...(providerSearch.notice ? { notice: providerSearch.notice } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "Place discovery is temporarily unavailable." },
      { status: 502 },
    );
  }
}
