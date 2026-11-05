import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db as defaultDb } from "@/db";
import { pushDevices } from "@/db/schema";
import { consumeRateLimit } from "@/lib/domain/rate-limit";

const registerSchema = z.object({
  platform: z.enum(["ios", "android"]),
  token: z.string().trim().min(1).max(4096),
});
const removeSchema = z.object({ token: z.string().trim().min(1).max(4096) });
type SessionUser = { id: string; sessionId: string } | null;
type Database = typeof defaultDb;

export async function handlePushDevicesRequest(
  request: Request,
  user: SessionUser,
  database: Database = defaultDb,
) {
  if (!user)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const rate = await consumeRateLimit(
    database,
    `push-devices:${user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many push-device requests." },
      { status: 429 },
    );

  const body = await request.json().catch(() => null);
  if (request.method === "POST") {
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid push device." },
        { status: 400 },
      );
    const now = new Date();
    const [device] = await database
      .insert(pushDevices)
      .values({
        ...parsed.data,
        userId: user.id,
        sessionId: user.sessionId,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: pushDevices.token,
        set: {
          userId: user.id,
          sessionId: user.sessionId,
          platform: parsed.data.platform,
          lastSeenAt: now,
        },
      })
      .returning({ id: pushDevices.id });
    return NextResponse.json({ ok: true, deviceId: device?.id });
  }

  if (request.method === "DELETE") {
    const parsed = removeSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid push device." },
        { status: 400 },
      );
    await database
      .delete(pushDevices)
      .where(
        and(
          eq(pushDevices.userId, user.id),
          eq(pushDevices.token, parsed.data.token),
        ),
      );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
