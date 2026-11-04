import { NextResponse } from "next/server";
import { z } from "zod";
import { getGeocoder } from "@/lib/providers/geocoding";

const querySchema = z.string().trim().min(2).max(200);

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q");
  const parsed = querySchema.safeParse(query);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Provide a location query of 2–200 characters." },
      { status: 400 },
    );
  try {
    const results = await getGeocoder().search(parsed.data);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Geocoding is temporarily unavailable." },
      { status: 502 },
    );
  }
}
