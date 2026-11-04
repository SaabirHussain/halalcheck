import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/lib/auth/service";
import { hasValidBrowserOrigin } from "@/lib/http/origin";

const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  if (!hasValidBrowserOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Unable to create account." },
      { status: 400 },
    );
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const clientIp = (
    forwarded ||
    request.headers.get("x-real-ip") ||
    "unknown"
  ).slice(0, 64);
  try {
    await registerUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.displayName,
      clientIp,
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to create account." },
      { status: 400 },
    );
  }
}
