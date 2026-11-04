import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import { users } from "@/db/schema";

export type Actor =
  | { type: "user"; userId: string }
  | { type: "admin"; userId: string }
  | { type: "system" }
  | { type: "worker" };

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireActorUser(
  actor: Actor,
  database: typeof defaultDb = defaultDb,
) {
  if (actor.type !== "user" && actor.type !== "admin") {
    throw new ForbiddenError("An authenticated user is required.");
  }
  const [user] = await database
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);
  if (!user) throw new ForbiddenError("The actor is not an active account.");
  return user;
}

export async function requireAdminActor(
  actor: Actor,
  database: typeof defaultDb = defaultDb,
) {
  if (actor.type !== "admin")
    throw new ForbiddenError("Administrator access required.");
  const user = await requireActorUser(actor, database);
  if (user.role !== "admin")
    throw new ForbiddenError("Administrator access required.");
  return user;
}
