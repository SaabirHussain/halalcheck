import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { branches, externalPlaceIds } from "@/db/schema";
import { consumeGoogleDetailsLimit } from "@/lib/providers/places/limits";
import { getPlacesProvider } from "@/lib/providers/places";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [placeId] = await db
    .select({
      provider: externalPlaceIds.provider,
      externalId: externalPlaceIds.externalId,
    })
    .from(externalPlaceIds)
    .innerJoin(branches, eq(externalPlaceIds.branchId, branches.id))
    .where(
      and(
        eq(branches.id, id),
        eq(branches.detailsSource, "provider"),
      ),
    )
    .limit(1);
  if (!placeId) {
    return NextResponse.json(
      { error: "Place details are unavailable." },
      { status: 404 },
    );
  }
  if (
    placeId.provider === "google" &&
    !(await consumeGoogleDetailsLimit(db))
  ) {
    return NextResponse.json({
      notice: "Place details are temporarily unavailable",
    });
  }
  try {
    const details = await getPlacesProvider().getPlace(
      placeId.externalId,
      "summary",
    );
    if (!details) throw new Error("Place details unavailable.");
    return NextResponse.json({
      ...details,
      detailsSource: "provider",
      attribution: placeId.provider === "google",
    });
  } catch {
    return NextResponse.json({
      notice: "Place details are temporarily unavailable",
    });
  }
}
