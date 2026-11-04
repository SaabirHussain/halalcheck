import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import { users } from "@/db/schema";
import type { Actor } from "./actor";
import { requireActorUser } from "./actor";
import { writeAudit } from "./audit";

export async function updateEmailNotifications(
  actor: Actor,
  enabled: boolean,
  database: typeof defaultDb = defaultDb,
) {
  const user = await requireActorUser(actor, database);
  await database
    .update(users)
    .set({ emailNotifications: enabled })
    .where(eq(users.id, user.id));
  await writeAudit(database, {
    actorUserId: user.id,
    actorType: user.role,
    action: "email_notification_preference_updated",
    entityType: "user",
    entityId: user.id,
    metadata: { enabled },
  });
}
