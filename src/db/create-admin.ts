import "dotenv/config";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "../lib/auth/password";
import { db, sql } from "./index";
import { users } from "./schema";

const adminEnvironment = z.object({
  ADMIN_EMAIL: z.string().trim().email().max(254),
  ADMIN_PASSWORD: z.string().min(12).max(128),
  ADMIN_NAME: z.string().trim().min(1).max(100).optional(),
});

async function createAdmin() {
  const parsed = adminEnvironment.safeParse({
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_NAME: process.env.ADMIN_NAME || undefined,
  });
  if (!parsed.success) {
    throw new Error("Set valid ADMIN_EMAIL and ADMIN_PASSWORD values.");
  }

  const email = parsed.data.ADMIN_EMAIL.toLowerCase();
  const displayName = parsed.data.ADMIN_NAME ?? "HalalCheck Administrator";
  const passwordHash = await hashPassword(parsed.data.ADMIN_PASSWORD);

  await db.transaction(async (transaction) => {
    const [existing] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(drizzleSql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (!existing) {
      await transaction
        .insert(users)
        .values({
          email,
          passwordHash,
          displayName,
          role: "admin",
        })
        .onConflictDoNothing();
    }

    const [user] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(drizzleSql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (!user) throw new Error("Unable to create the admin account.");

    await transaction
      .update(users)
      .set({
        role: "admin",
        ...(parsed.data.ADMIN_NAME ? { displayName } : {}),
      })
      .where(eq(users.id, user.id));
  });
}

try {
  await createAdmin();
  console.info("Admin account is ready.");
} catch {
  console.error("Unable to create or promote the admin account.");
  process.exitCode = 1;
} finally {
  await sql.end();
}
