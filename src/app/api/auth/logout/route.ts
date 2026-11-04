import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth/sessions";
import { hasValidBrowserOrigin } from "@/lib/http/origin";

export async function POST(request: Request) {
  if (!hasValidBrowserOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  await revokeCurrentSession();
  return NextResponse.json({ ok: true });
}
