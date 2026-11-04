import { and, eq, inArray } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  branchFollows,
  emailOutbox,
  investigationSubscriptions,
  notificationEmails,
  notifications,
  publishedRevisions,
  proposedUpdates,
  users,
} from "@/db/schema";
import type { Actor } from "./actor";

type Database = typeof defaultDb;

export async function notifyFollowers(
  actor: Actor,
  revisionId: string,
  database: Database = defaultDb,
) {
  if (actor.type !== "worker" && actor.type !== "system") throw new Error("Worker access required.");
  const [revision] = await database
    .select()
    .from(publishedRevisions)
    .where(eq(publishedRevisions.id, revisionId))
    .limit(1);
  if (!revision) throw new Error("Published revision not found.");
  const [proposal] = revision.proposedUpdateId
    ? await database
        .select({ investigationId: proposedUpdates.investigationId })
        .from(proposedUpdates)
        .where(eq(proposedUpdates.id, revision.proposedUpdateId))
        .limit(1)
    : [];
  const subscribedIds = proposal?.investigationId
    ? await database
        .select({ userId: investigationSubscriptions.userId })
        .from(investigationSubscriptions)
        .where(eq(investigationSubscriptions.investigationId, proposal.investigationId))
    : [];
  const branchFollowers = await database
    .select({ userId: branchFollows.userId })
    .from(branchFollows)
    .where(eq(branchFollows.branchId, revision.branchId));
  const recipientIds = [...new Set([...subscribedIds, ...branchFollowers].map((entry) => entry.userId))];
  if (!recipientIds.length) return 0;
  const recipients = await database
    .select({
      id: users.id,
      email: users.email,
      emailNotifications: users.emailNotifications,
    })
    .from(users)
    .where(inArray(users.id, recipientIds));
  const type = revision.outcome === "unable_to_confirm" ? "investigation_unsuccessful" : "findings_published";
  let createdCount = 0;
  for (const user of recipients) {
    const [notification] = await database
      .insert(notifications)
      .values({
        userId: user.id,
        type,
        branchId: revision.branchId,
        title: type === "findings_published" ? "Research findings published" : "Research could not be confirmed",
        body: revision.publicSummary,
        link: `/places/${revision.branchId}`,
        dedupeKey: `revision:${revision.id}`,
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    if (!notification) continue;
    createdCount += 1;
    if (user.emailNotifications) {
      const [email] = await database
        .insert(emailOutbox)
        .values({
          to: user.email,
          from: process.env.OUTREACH_FROM_ADDRESS ?? "research@demo.halalcheck.test",
          subject: "HalalCheck research update",
          bodyText: revision.publicSummary,
          purpose: "notification",
          status: "captured",
        })
        .returning({ id: emailOutbox.id });
      if (email) {
        await database.insert(notificationEmails).values({
          notificationId: notification.id,
          emailOutboxId: email.id,
        });
      }
    }
  }
  return createdCount;
}

export async function markNotificationRead(
  actor: Actor,
  notificationId: string,
  database: Database = defaultDb,
) {
  if (actor.type !== "user" && actor.type !== "admin") throw new Error("Authenticated user required.");
  const [row] = await database
    .update(notifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, actor.userId)))
    .returning({ id: notifications.id });
  if (!row) throw new Error("Notification not found.");
}
