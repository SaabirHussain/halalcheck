import { NextResponse } from "next/server";
import { db } from "@/db";
import { allowProviderSearch } from "@/lib/http/browser-gate";
import { getClientIp } from "@/lib/http/client-ip";
import {
  consumeGooglePhotoLimit,
} from "@/lib/providers/places/limits";
import { isValidPlacePhotoName } from "@/lib/providers/places/photos";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (
    !isValidPlacePhotoName(name) ||
    !allowProviderSearch(request.headers) ||
    process.env.PLACES_PROVIDER !== "google" ||
    !apiKey
  ) {
    return new Response(null, { status: 404 });
  }

  try {
    if (!(await consumeGooglePhotoLimit(db, getClientIp(request.headers)))) {
      return new Response(null, { status: 404 });
    }
    const response = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
      {
        headers: { "X-Goog-Api-Key": apiKey },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return new Response(null, { status: 404 });
    const payload = (await response.json()) as { photoUri?: unknown };
    if (typeof payload.photoUri !== "string" || !payload.photoUri) {
      return new Response(null, { status: 404 });
    }
    return NextResponse.redirect(payload.photoUri, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
