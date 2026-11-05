import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db as defaultDb } from "@/db";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "halalcheck_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  database: typeof defaultDb = defaultDb,
) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await database.insert(sessions).values({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return { token, expiresAt };
}

export async function getCurrentUser(database: typeof defaultDb = defaultDb) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || token.length !== 64) return null;
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const [session] = await database
    .select({
      id: sessions.id,
      expiresAt: sessions.expiresAt,
      user: {
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        emailNotifications: users.emailNotifications,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!session) return null;
  if (session.expiresAt.getTime() - now.getTime() < 29 * 24 * 60 * 60 * 1000) {
    const refreshedExpiry = new Date(now.getTime() + SESSION_DURATION_MS);
    await database
      .update(sessions)
      .set({ expiresAt: refreshedExpiry })
      .where(eq(sessions.id, session.id));
    try {
      cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: refreshedExpiry,
      });
    } catch {
      // Server Component renders cannot mutate cookies; DB expiry still rolls forward.
    }
  }
  return { ...session.user, sessionId: session.id };
}

export async function revokeSessionByToken(
  token: string,
  database: typeof defaultDb = defaultDb,
) {
  await database
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(token)));
}

export async function revokeCurrentSession(
  database: typeof defaultDb = defaultDb,
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionByToken(token, database);
  cookieStore.delete(SESSION_COOKIE);
}

export const logout = revokeCurrentSession;
