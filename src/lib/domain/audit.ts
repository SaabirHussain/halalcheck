import { auditEvents } from "@/db/schema";

export type AuditRecord = {
  actorUserId?: string | null;
  actorType: "user" | "admin" | "system" | "worker";
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function writeAudit(executor: { insert: (...args: never[]) => unknown }, event: AuditRecord) {
  const safeMetadata = Object.fromEntries(
    Object.entries(event.metadata ?? {}).filter(
      ([key, value]) =>
        !/(body|email|phone|token|secret|password|message|raw|content)/i.test(key) &&
        (typeof value !== "string" || value.length <= 200),
    ),
  ) as Record<string, string | number | boolean | null>;
  await (executor as typeof import("@/db").db)
    .insert(auditEvents)
    .values({
      actorUserId: event.actorUserId ?? null,
      actorType: event.actorType,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      metadata: safeMetadata,
    });
}
