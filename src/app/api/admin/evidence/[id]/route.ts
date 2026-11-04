import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { evidenceDocuments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { readEvidence } from "@/lib/providers/storage/local";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  const { id } = await context.params;
  const [document] = await db
    .select({
      storageKey: evidenceDocuments.storageKey,
      mime: evidenceDocuments.mime,
      originalFilename: evidenceDocuments.originalFilename,
    })
    .from(evidenceDocuments)
    .where(eq(evidenceDocuments.id, id))
    .limit(1);
  if (!document) return NextResponse.json({ error: "Evidence document not found." }, { status: 404 });
  try {
    const bytes = await readEvidence(document.storageKey);
    const filename = document.originalFilename.replace(/[\r\n"\\]/g, "_").slice(0, 120);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": document.mime,
        "Content-Disposition": `attachment; filename="${filename || "evidence"}"`,
        "Content-Length": String(bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Evidence file is unavailable." }, { status: 404 });
  }
}
