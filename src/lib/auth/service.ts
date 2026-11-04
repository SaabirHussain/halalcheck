import { sql } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import { users } from "@/db/schema";
import { consumeRateLimit } from "@/lib/domain/rate-limit";
import { hashPassword, verifyPassword } from "./password";
import { createSession } from "./sessions";

export async function authenticateUser(
  email: string,
  password: string,
  clientIp = "unknown",
  database: typeof defaultDb = defaultDb,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const [ipLimit, emailLimit] = await Promise.all([
    consumeRateLimit(database, `login:ip:${clientIp}`, 20, 60 * 60 * 1000),
    consumeRateLimit(
      database,
      `login:email:${normalizedEmail}`,
      10,
      60 * 60 * 1000,
    ),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed)
    throw new Error("Invalid email or password.");
  const [user] = await database
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error("Invalid email or password.");
  }
  await createSession(user.id, database);
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  clientIp = "unknown",
  database: typeof defaultDb = defaultDb,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const [ipLimit, emailLimit] = await Promise.all([
    consumeRateLimit(database, `signup:ip:${clientIp}`, 10, 60 * 60 * 1000),
    consumeRateLimit(
      database,
      `signup:email:${normalizedEmail}`,
      5,
      60 * 60 * 1000,
    ),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed)
    throw new Error("Unable to create account.");
  const passwordHash = await hashPassword(password);
  const [user] = await database
    .insert(users)
    .values({
      email: normalizedEmail,
      passwordHash,
      displayName: displayName.trim(),
    })
    .onConflictDoNothing()
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
    });
  if (!user) throw new Error("Unable to create account.");
  await createSession(user.id, database);
  return user;
}
