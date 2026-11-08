import { NextResponse } from "next/server";
import { readPublicPhoto } from "@/lib/providers/storage/local";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  const contentType = key.endsWith(".png")
    ? "image/png"
    : key.endsWith(".jpg")
      ? "image/jpeg"
      : key.endsWith(".webp")
        ? "image/webp"
        : null;
  if (!contentType) return new Response(null, { status: 404 });

  try {
    const bytes = await readPublicPhoto(key);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Photo not found." },
      { status: 404 },
    );
  }
}
