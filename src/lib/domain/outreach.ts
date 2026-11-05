import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  branches,
  businesses,
  claims,
  contactEndpoints,
  investigations,
  outreachMessages,
  outreachSettings,
  outreachThreads,
  suppressions,
} from "@/db/schema";
import { getEmailProvider } from "@/lib/providers/email";
import type { EmailProvider } from "@/lib/providers/email/types";
import type { JobQueue } from "@/lib/jobs/types";
import type { Actor } from "./actor";
import { requireAdminActor } from "./actor";
import { writeAudit } from "./audit";

type Database = typeof defaultDb;

export const researchQuestions = [
  {
    key: "chicken_supplier",
    prompt: "Which supplier provides your chicken?",
    product: "chicken",
    attribute: "supplier",
  },
  {
    key: "beef_supplier",
    prompt: "Which supplier provides your beef?",
    product: "beef",
    attribute: "supplier",
  },
  {
    key: "lamb_supplier",
    prompt: "Which supplier provides your lamb?",
    product: "lamb",
    attribute: "supplier",
  },
  {
    key: "chicken_slaughter",
    prompt: "Is your chicken hand- or machine-slaughtered?",
    product: "chicken",
    attribute: "slaughter_method",
  },
  {
    key: "beef_slaughter",
    prompt: "Is your beef hand- or machine-slaughtered?",
    product: "beef",
    attribute: "slaughter_method",
  },
  {
    key: "certifier",
    prompt:
      "Which organization certifies the relevant products, and does coverage include this branch?",
    product: "general",
    attribute: "certifier",
  },
  {
    key: "certificate",
    prompt: "Can you share a current certificate or supplier documentation?",
    product: "general",
    attribute: "certificate",
  },
  {
    key: "menu_coverage",
    prompt: "Are all menu items halal, or only selected items?",
    product: "menu",
    attribute: "menu_coverage",
  },
  {
    key: "separate_preparation",
    prompt: "Are halal items prepared separately from non-halal items?",
    product: "kitchen",
    attribute: "separate_preparation",
  },
  {
    key: "shared_grill",
    prompt: "Are grills shared with non-halal items?",
    product: "kitchen",
    attribute: "shared_grill",
  },
  {
    key: "shared_fryer",
    prompt: "Are fryers shared with non-halal items?",
    product: "kitchen",
    attribute: "shared_fryer",
  },
  {
    key: "shared_utensils",
    prompt: "Are utensils shared with non-halal items?",
    product: "kitchen",
    attribute: "shared_utensils",
  },
  {
    key: "shared_storage",
    prompt: "Is storage shared with non-halal items?",
    product: "kitchen",
    attribute: "shared_storage",
  },
] as const;

export function openQuestionKeysForClaims(
  knownClaims: Array<{
    product: string;
    attribute: string;
    valueEnum: string | null;
    value: string;
  }>,
) {
  return researchQuestions.filter((question) => {
    const answers = knownClaims.filter(
      (claim) =>
        (question.product === "general" ||
          claim.product === question.product) &&
        claim.attribute === question.attribute &&
        claim.valueEnum !== "unknown" &&
        !/\b(not sure|unknown|don't know|do not know)\b/i.test(claim.value),
    );
    return answers.length === 0;
  });
}

export function vagueAnswerTargetQuestionKeys(vagueSignals: string[]) {
  const targetKeys = new Set<string>();
  if (vagueSignals.includes("general_halal_claim")) {
    for (const key of [
      "chicken_supplier",
      "beef_supplier",
      "lamb_supplier",
      "chicken_slaughter",
      "beef_slaughter",
      "certifier",
    ]) {
      targetKeys.add(key);
    }
  }
  if (vagueSignals.includes("certified_no_org")) {
    targetKeys.add("certifier");
    targetKeys.add("certificate");
  }
  return targetKeys;
}

export async function createOutreachDraft(
  actor: Actor,
  investigationId: string,
  database: Database = defaultDb,
  queue?: JobQueue,
  options: { vagueSignals?: string[] } = {},
) {
  if (!["worker", "system", "admin"].includes(actor.type))
    throw new Error("Automation access required.");
  if (actor.type === "admin") await requireAdminActor(actor, database);
  const [investigation] = await database
    .select({
      id: investigations.id,
      branchId: investigations.branchId,
      status: investigations.status,
      kind: investigations.kind,
      isActive: investigations.isActive,
      stageDetail: investigations.stageDetail,
      branchName: branches.name,
      businessName: businesses.name,
    })
    .from(investigations)
    .innerJoin(branches, eq(investigations.branchId, branches.id))
    .innerJoin(businesses, eq(branches.businessId, businesses.id))
    .where(eq(investigations.id, investigationId))
    .limit(1);
  if (!investigation || !investigation.isActive)
    throw new Error("Active investigation not found.");

  const currentClaims = await database
    .select({
      product: claims.product,
      attribute: claims.attribute,
      value: claims.value,
      valueEnum: claims.valueEnum,
    })
    .from(claims)
    .where(
      and(
        eq(claims.branchId, investigation.branchId),
        inArray(claims.status, ["published", "proposed"]),
      ),
    );
  const openQuestions = openQuestionKeysForClaims(currentClaims);
  if (!openQuestions.length) {
    if (queue)
      await queue.enqueue(
        "investigation.evidence_review",
        { investigationId },
        { singletonKey: `evidence_review:${investigationId}` },
      );
    return { status: "reviewing_evidence" as const, messageId: null };
  }
  const [endpoint] = await database
    .select()
    .from(contactEndpoints)
    .where(
      and(
        eq(contactEndpoints.branchId, investigation.branchId),
        eq(contactEndpoints.kind, "email"),
        inArray(contactEndpoints.status, ["approved", "unverified"]),
      ),
    )
    .limit(1);
  if (!endpoint || endpoint.status === "ambiguous" || endpoint.isPersonal) {
    await database.transaction(async (tx) => {
      await tx
        .update(investigations)
        .set({
          status: "reviewing_evidence",
          stageDetail: investigation.stageDetail?.startsWith(
            "Website fetch failed:",
          )
            ? `${investigation.stageDetail} No usable business contact found.`
            : "No usable business contact found.",
          updatedAt: new Date(),
        })
        .where(eq(investigations.id, investigationId));
      await tx
        .update(branches)
        .set({ researchStatus: "reviewing_evidence", updatedAt: new Date() })
        .where(eq(branches.id, investigation.branchId));
    });
    if (queue) {
      await queue.enqueue(
        "investigation.evidence_review",
        { investigationId },
        { singletonKey: `evidence_review:${investigationId}` },
      );
    }
    return { status: "reviewing_evidence" as const, messageId: null };
  }

  const [existingThread] = await database
    .select({ id: outreachThreads.id })
    .from(outreachThreads)
    .where(eq(outreachThreads.investigationId, investigationId))
    .limit(1);
  const threadId =
    existingThread?.id ??
    (
      await database
        .insert(outreachThreads)
        .values({
          investigationId,
          branchId: investigation.branchId,
          contactEndpointId: endpoint.id,
          threadToken: randomUUID(),
          status: "open",
        })
        .onConflictDoNothing()
        .returning({ id: outreachThreads.id })
    )[0]?.id;
  if (!threadId) {
    const [thread] = await database
      .select({ id: outreachThreads.id })
      .from(outreachThreads)
      .where(eq(outreachThreads.investigationId, investigationId))
      .limit(1);
    if (!thread) throw new Error("Could not create outreach thread.");
    return createOutreachDraft(
      actor,
      investigationId,
      database,
      queue,
      options,
    );
  }
  const [pendingMessage] = await database
    .select({ id: outreachMessages.id })
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.threadId, threadId),
        eq(outreachMessages.direction, "outbound"),
        inArray(outreachMessages.status, [
          "draft",
          "approved",
          "scheduled",
          "sending",
        ]),
      ),
    )
    .orderBy(desc(outreachMessages.sequence))
    .limit(1);
  if (pendingMessage) {
    return {
      status: "awaiting_outreach_approval" as const,
      messageId: pendingMessage.id,
    };
  }
  const [prior] = await database
    .select({ sequence: outreachMessages.sequence })
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.threadId, threadId),
        eq(outreachMessages.direction, "outbound"),
      ),
    )
    .orderBy(desc(outreachMessages.sequence))
    .limit(1);
  const sequence = (prior?.sequence ?? 0) + 1;
  const isFollowup = sequence > 1;
  const priorOutbound = isFollowup
    ? await database
        .select({ questions: outreachMessages.questions })
        .from(outreachMessages)
        .where(
          and(
            eq(outreachMessages.threadId, threadId),
            eq(outreachMessages.direction, "outbound"),
          ),
        )
        .orderBy(asc(outreachMessages.sequence))
    : [];
  const priorQuestionKeys = new Set(
    priorOutbound.flatMap((message) => message.questions),
  );
  const vagueSignals = new Set(options.vagueSignals ?? []);
  const vagueTargets = vagueAnswerTargetQuestionKeys([...vagueSignals]);
  const questionScope = isFollowup
    ? new Set([...priorQuestionKeys, ...vagueTargets])
    : undefined;
  const selectedQuestions = openQuestions
    .filter((question) => !questionScope || questionScope.has(question.key))
    .slice(0, isFollowup ? openQuestions.length : 3);
  if (isFollowup && selectedQuestions.length === 0) {
    if (queue)
      await queue.enqueue(
        "investigation.evidence_review",
        { investigationId },
        { singletonKey: `evidence_review:${investigationId}` },
      );
    return { status: "reviewing_evidence" as const, messageId: null };
  }
  const questions = selectedQuestions.map((question) => question.key);
  const targetedIntro = isFollowup
    ? vagueSignals.has("general_halal_claim")
      ? "Thank you — you mentioned your meat is halal. To summarise this accurately, could you tell us which suppliers provide each meat and which organization certifies them?"
      : vagueSignals.has("certified_no_org")
        ? "Which organization certifies it, and does the certification cover this branch and these products?"
        : vagueSignals.has("staff_dont_know")
          ? "Could you connect us with a manager or purchasing contact who can confirm the details?"
          : null
    : null;
  const bodyText = [
    `Hello,`,
    ``,
    isFollowup
      ? `Thank you for your reply about ${investigation.businessName} (${investigation.branchName}).`
      : `I’m an automated research assistant on behalf of HalalCheck, a community research directory. We are reviewing ${investigation.businessName} (${investigation.branchName}) and would appreciate a few details:`,
    ...(targetedIntro ? [targetedIntro, ""] : []),
    ...selectedQuestions.map((question) => `• ${question.prompt}`),
    ``,
    `Your answers may be summarized publicly with their source and date. We will not present unanswered questions as facts. You can opt out at any time by replying STOP.`,
    ``,
    `Thank you,`,
    `HalalCheck research team`,
  ].join("\n");
  const [message] = await database
    .insert(outreachMessages)
    .values({
      threadId,
      direction: "outbound",
      sequence,
      kind: isFollowup ? "followup" : "initial",
      status: "draft",
      subject: "A few questions from HalalCheck",
      bodyText,
      questions,
      idempotencyKey: `outreach:${threadId}:${sequence}`,
      messageIdHeader: `<${randomUUID()}@${process.env.OUTREACH_REPLY_DOMAIN ?? "demo.halalcheck.test"}>`,
    })
    .onConflictDoNothing()
    .returning({ id: outreachMessages.id });

  const [settings] = await database.select().from(outreachSettings).limit(1);
  await database.transaction(async (tx) => {
    await tx
      .update(investigations)
      .set({
        status: "awaiting_outreach_approval",
        stageDetail: investigation.stageDetail?.startsWith(
          "Website fetch failed:",
        )
          ? `${investigation.stageDetail} Outreach draft awaits review.`
          : "Outbound draft awaits review.",
        updatedAt: new Date(),
      })
      .where(eq(investigations.id, investigationId));
    await tx
      .update(branches)
      .set({
        researchStatus: "awaiting_outreach_approval",
        updatedAt: new Date(),
      })
      .where(eq(branches.id, investigation.branchId));
    await writeAudit(tx, {
      actorType: actor.type === "admin" ? "admin" : actor.type,
      actorUserId: actor.type === "admin" ? actor.userId : null,
      action: "outreach_draft_created",
      entityType: "investigation",
      entityId: investigationId,
      metadata: { questionCount: questions.length },
    });
  });
  if (
    message &&
    investigation.kind !== "refresh" &&
    settings?.mode === "auto_send_approved" &&
    endpoint.status === "approved"
  ) {
    await database
      .update(outreachMessages)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(outreachMessages.id, message.id));
    await writeAudit(database, {
      actorType: actor.type === "admin" ? "admin" : actor.type,
      actorUserId: actor.type === "admin" ? actor.userId : null,
      action: "outreach_auto_approved",
      entityType: "outreach_message",
      entityId: message.id,
    });
    if (queue)
      await queue.enqueue(
        "outreach.send",
        { messageId: message.id },
        { singletonKey: `outreach:${message.id}` },
      );
  }
  return {
    status: "awaiting_outreach_approval" as const,
    messageId: message?.id ?? null,
  };
}

export async function approveOutreachMessage(
  actor: Actor,
  messageId: string,
  queue: JobQueue,
  database: Database = defaultDb,
  options: { approveContact?: boolean } = {},
) {
  const admin = await requireAdminActor(actor, database);
  await database.transaction(async (tx) => {
    const [draft] = await tx
      .select({ id: outreachMessages.id, threadId: outreachMessages.threadId })
      .from(outreachMessages)
      .where(
        and(
          eq(outreachMessages.id, messageId),
          eq(outreachMessages.status, "draft"),
        ),
      )
      .limit(1);
    if (!draft) throw new Error("Draft message not found or already reviewed.");
    const [thread] = await tx
      .select({ contactEndpointId: outreachThreads.contactEndpointId })
      .from(outreachThreads)
      .where(eq(outreachThreads.id, draft.threadId))
      .limit(1);
    const [endpoint] = thread?.contactEndpointId
      ? await tx
          .select()
          .from(contactEndpoints)
          .where(eq(contactEndpoints.id, thread.contactEndpointId))
          .for("update")
          .limit(1)
      : [];
    if (!endpoint) throw new Error("Outreach contact endpoint not found.");
    if (endpoint.status !== "approved") {
      if (!options.approveContact) {
        throw new Error(
          "Approve the contact endpoint before approving this outreach draft.",
        );
      }
      await tx
        .update(contactEndpoints)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(contactEndpoints.id, endpoint.id));
      await writeAudit(tx, {
        actorUserId: admin.id,
        actorType: "admin",
        action: "contact_endpoint_approved",
        entityType: "contact_endpoint",
        entityId: endpoint.id,
      });
    }
    await tx
      .update(outreachMessages)
      .set({ status: "approved", approvedBy: admin.id, updatedAt: new Date() })
      .where(eq(outreachMessages.id, messageId));
    await writeAudit(tx, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "outreach_approved",
      entityType: "outreach_message",
      entityId: messageId,
    });
  });
  await queue.enqueue(
    "outreach.send",
    { messageId },
    { singletonKey: `outreach:${messageId}` },
  );
}

export async function retryFailedOutreachSend(
  actor: Actor,
  messageId: string,
  queue: JobQueue,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [message] = await database
    .update(outreachMessages)
    .set({
      status: "approved",
      approvedBy: admin.id,
      error: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(outreachMessages.id, messageId),
        eq(outreachMessages.status, "failed"),
      ),
    )
    .returning({
      id: outreachMessages.id,
      threadId: outreachMessages.threadId,
    });
  if (!message) throw new Error("Failed outreach message not found.");
  const [thread] = await database
    .select({ investigationId: outreachThreads.investigationId })
    .from(outreachThreads)
    .where(eq(outreachThreads.id, message.threadId))
    .limit(1);
  const retryKey = `outreach:${messageId}:retry:${randomUUID()}`;
  if (thread) {
    await database
      .update(investigations)
      .set({
        stageDetail: "Retrying a failed outreach send.",
        updatedAt: new Date(),
      })
      .where(eq(investigations.id, thread.investigationId));
  }
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "outreach_send_retried",
    entityType: "outreach_message",
    entityId: messageId,
  });
  await queue.enqueue(
    "outreach.send",
    { messageId },
    { idempotencyKey: retryKey, singletonKey: retryKey },
  );
}

export async function rejectOutreachMessage(
  actor: Actor,
  messageId: string,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [message] = await database
    .update(outreachMessages)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(outreachMessages.id, messageId),
        eq(outreachMessages.status, "draft"),
      ),
    )
    .returning({ id: outreachMessages.id });
  if (!message) throw new Error("Draft message not found or already reviewed.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "outreach_rejected",
    entityType: "outreach_message",
    entityId: messageId,
  });
}

export async function setOutreachSettings(
  actor: Actor,
  settings: {
    mode?: "manual_approval" | "auto_send_approved";
    paused?: boolean;
    maxFollowups?: number;
    minDaysBetweenMessages?: number;
    maxMessagesPerBusiness30d?: number;
    noResponseDays?: number;
  },
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  for (const value of Object.values(settings)) {
    if (
      typeof value === "number" &&
      (!Number.isInteger(value) || value < 0 || value > 30)
    ) {
      throw new Error("Outreach limits must be integers between 0 and 30.");
    }
  }
  await database
    .insert(outreachSettings)
    .values({ id: 1, ...settings })
    .onConflictDoUpdate({
      target: outreachSettings.id,
      set: { ...settings, updatedAt: new Date() },
    });
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "outreach_settings_updated",
    entityType: "outreach_settings",
    entityId: "1",
    metadata: { ...settings },
  });
}

export async function approveContactEndpoint(
  actor: Actor,
  endpointId: string,
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const [updated] = await database
    .update(contactEndpoints)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(contactEndpoints.id, endpointId))
    .returning({ id: contactEndpoints.id });
  if (!updated) throw new Error("Contact endpoint not found.");
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "contact_endpoint_approved",
    entityType: "contact_endpoint",
    entityId: endpointId,
  });
}

export async function addSuppression(
  actor: Actor,
  input: {
    value: string;
    kind: "email" | "domain";
    reason: "manual" | "opt_out" | "bounce" | "refusal";
    note?: string;
  },
  database: Database = defaultDb,
) {
  const admin = await requireAdminActor(actor, database);
  const normalized = input.value.trim().toLowerCase();
  if (input.kind === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized))
    throw new Error("Valid email required.");
  if (input.kind === "domain" && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized))
    throw new Error("Valid domain required.");
  const [row] = await database
    .insert(suppressions)
    .values({
      valueNormalized: normalized,
      kind: input.kind,
      reason: input.reason,
      createdBy: admin.id,
      note: input.note,
    })
    .onConflictDoNothing()
    .returning({ id: suppressions.id });
  await writeAudit(database, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "contact_suppressed",
    entityType: "suppression",
    entityId: row?.id ?? normalized,
    metadata: { kind: input.kind, reason: input.reason },
  });
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function nextBusinessWindow(
  now: Date,
  timezone: string,
  hours = process.env.OUTREACH_BUSINESS_HOURS ?? "09:00-17:00",
  days = process.env.OUTREACH_BUSINESS_DAYS ?? "1-5",
) {
  const [openText, closeText] = hours.split("-");
  const [openHour, openMinute] = (openText ?? "09:00").split(":").map(Number);
  const [closeHour, closeMinute] = (closeText ?? "17:00")
    .split(":")
    .map(Number);
  const allowedDays = new Set(
    days.split(",").flatMap((range) => {
      const [start, end = start] = range.split("-").map(Number);
      return Array.from(
        { length: (end ?? 0) - (start ?? 0) + 1 },
        (_, offset) => (start ?? 1) + offset,
      );
    }),
  );
  for (let minute = 0; minute <= 8 * 24 * 60; minute += 1) {
    const candidate = new Date(now.getTime() + minute * 60_000);
    const parts = localParts(candidate, timezone);
    const weekdays: Record<string, number> = {
      Sun: 7,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const weekday = weekdays[parts.weekday ?? ""] ?? 0;
    const hour = Number(parts.hour);
    const currentMinute = Number(parts.minute);
    const inHours =
      (hour > (openHour ?? 9) ||
        (hour === openHour && currentMinute >= (openMinute ?? 0))) &&
      (hour < (closeHour ?? 17) ||
        (hour === closeHour && currentMinute < (closeMinute ?? 0)));
    if (allowedDays.has(weekday) && inHours) return candidate;
  }
  throw new Error("No business hour found in scheduling horizon.");
}

export async function sendOutreach(
  actor: Actor,
  messageId: string,
  database: Database = defaultDb,
  queue?: JobQueue,
  provider: EmailProvider = getEmailProvider(database),
) {
  if (actor.type !== "worker" && actor.type !== "system")
    throw new Error("Worker access required.");
  const [message] = await database
    .update(outreachMessages)
    .set({ status: "sending", updatedAt: new Date() })
    .where(
      and(
        eq(outreachMessages.id, messageId),
        inArray(outreachMessages.status, ["approved", "scheduled"]),
      ),
    )
    .returning();
  if (!message) return { sent: false, reason: "already-claimed" };
  const [thread] = await database
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.id, message.threadId))
    .limit(1);
  const [endpoint] = thread?.contactEndpointId
    ? await database
        .select()
        .from(contactEndpoints)
        .where(eq(contactEndpoints.id, thread.contactEndpointId))
        .limit(1)
    : [];
  const [settings] = await database.select().from(outreachSettings).limit(1);
  if (!thread || !endpoint || thread.status !== "open") {
    await database
      .update(outreachMessages)
      .set({ status: "cancelled" })
      .where(eq(outreachMessages.id, messageId));
    return { sent: false, reason: "thread-not-sendable" };
  }
  const [investigation] = await database
    .select({
      isActive: investigations.isActive,
      paused: investigations.paused,
    })
    .from(investigations)
    .where(eq(investigations.id, thread.investigationId))
    .limit(1);
  if (!investigation?.isActive) {
    await database
      .update(outreachMessages)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(outreachMessages.id, messageId));
    return { sent: false, reason: "investigation-inactive" };
  }
  if (investigation.paused) {
    return reschedule(
      database,
      queue,
      messageId,
      new Date(Date.now() + 60 * 60 * 1000),
      "investigation-paused",
    );
  }
  if (settings?.paused)
    return reschedule(
      database,
      queue,
      messageId,
      new Date(Date.now() + 60 * 60 * 1000),
      "paused",
    );
  const normalized = endpoint.value.trim().toLowerCase();
  const domain = normalized.split("@").pop() ?? normalized;
  const blocked = await database
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(and(eq(suppressions.valueNormalized, normalized)))
    .limit(1);
  const blockedDomain = await database
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(
      and(
        eq(suppressions.valueNormalized, domain),
        eq(suppressions.kind, "domain"),
      ),
    )
    .limit(1);
  if (
    blocked.length ||
    blockedDomain.length ||
    endpoint.status !== "approved"
  ) {
    await database
      .update(outreachMessages)
      .set({ status: "cancelled" })
      .where(eq(outreachMessages.id, messageId));
    return { sent: false, reason: "suppressed-or-unapproved" };
  }
  const [branch] = await database
    .select({
      id: branches.id,
      businessId: branches.businessId,
      timezone: branches.timezone,
    })
    .from(branches)
    .where(eq(branches.id, thread.branchId))
    .limit(1);
  if (!branch) throw new Error("Branch not found.");
  const branchIds = await database
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.businessId, branch.businessId));
  const branchIdList = branchIds.map((item) => item.id);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const outbound = branchIdList.length
    ? await database
        .select({ sentAt: outreachMessages.sentAt })
        .from(outreachMessages)
        .innerJoin(
          outreachThreads,
          eq(outreachMessages.threadId, outreachThreads.id),
        )
        .where(
          and(
            inArray(outreachThreads.branchId, branchIdList),
            eq(outreachMessages.direction, "outbound"),
            inArray(outreachMessages.status, ["sent", "captured"]),
            gte(outreachMessages.sentAt, since),
          ),
        )
    : [];
  const maxPerBusiness = settings?.maxMessagesPerBusiness30d ?? 4;
  if (outbound.length >= maxPerBusiness) {
    await database
      .update(outreachMessages)
      .set({ status: "failed", error: "Business contact limit reached." })
      .where(eq(outreachMessages.id, messageId));
    return { sent: false, reason: "business-limit" };
  }
  const lastSent = outbound
    .map((item) => item.sentAt)
    .filter((date): date is Date => !!date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (
    lastSent &&
    Date.now() - lastSent.getTime() <
      (settings?.minDaysBetweenMessages ?? 3) * 86400_000
  ) {
    return reschedule(
      database,
      queue,
      messageId,
      new Date(
        lastSent.getTime() +
          (settings?.minDaysBetweenMessages ?? 3) * 86400_000,
      ),
      "minimum-gap",
    );
  }
  const scheduledFor = nextBusinessWindow(new Date(), branch.timezone);
  if (scheduledFor.getTime() > Date.now() + 60_000) {
    return reschedule(
      database,
      queue,
      messageId,
      scheduledFor,
      "business-hours",
    );
  }
  const [fromAddress] = [
    process.env.OUTREACH_FROM_ADDRESS ?? "research@demo.halalcheck.test",
  ];
  const [threadRecord] = await database
    .select({ token: outreachThreads.threadToken })
    .from(outreachThreads)
    .where(eq(outreachThreads.id, thread.id))
    .limit(1);
  let sent: Awaited<ReturnType<ReturnType<typeof getEmailProvider>["send"]>>;
  try {
    sent = await provider.send({
      to: endpoint.value,
      from: fromAddress,
      subject: message.subject,
      bodyText: `${message.bodyText}\n\nHalalCheck is a community research directory. Answers may be summarized publicly. Reply STOP to opt out.`,
      purpose: "outreach",
      relatedMessageId: message.id,
      headers: {
        "Reply-To": `reply+${threadRecord!.token}@${process.env.OUTREACH_REPLY_DOMAIN ?? "demo.halalcheck.test"}`,
        "Message-ID":
          message.messageIdHeader ?? `<${message.id}@demo.halalcheck.test>`,
        "List-Unsubscribe": `<mailto:unsubscribe@${process.env.OUTREACH_REPLY_DOMAIN ?? "demo.halalcheck.test"}?subject=unsubscribe>`,
      },
    });
  } catch (error) {
    const safeError = sanitizeProviderError(error);
    await database.transaction(async (tx) => {
      await tx
        .update(outreachMessages)
        .set({ status: "failed", error: safeError, updatedAt: new Date() })
        .where(eq(outreachMessages.id, message.id));
      await tx
        .update(investigations)
        .set({
          stageDetail: `Email provider failed: ${safeError}`,
          updatedAt: new Date(),
        })
        .where(eq(investigations.id, thread.investigationId));
      await writeAudit(tx, {
        actorType: "worker",
        action: "outreach_send_failed",
        entityType: "outreach_message",
        entityId: message.id,
        metadata: { error: safeError },
      });
    });
    return { sent: false, reason: "provider-error" };
  }
  const sentAt = new Date();
  await database.transaction(async (tx) => {
    await tx
      .update(outreachMessages)
      .set({
        status: sent.captured ? "captured" : "sent",
        providerMessageId: sent.providerMessageId,
        sentAt,
        updatedAt: sentAt,
      })
      .where(eq(outreachMessages.id, message.id));
    await tx
      .update(investigations)
      .set({ status: "awaiting_business_response", updatedAt: sentAt })
      .where(eq(investigations.id, thread.investigationId));
    await tx
      .update(branches)
      .set({ researchStatus: "awaiting_business_response", updatedAt: sentAt })
      .where(eq(branches.id, thread.branchId));
    if (message.kind === "followup") {
      await tx
        .update(outreachThreads)
        .set({ followupsSent: thread.followupsSent + 1, updatedAt: sentAt })
        .where(eq(outreachThreads.id, thread.id));
    }
  });
  if (queue) {
    await queue.enqueue(
      "outreach.no_response_check",
      { investigationId: thread.investigationId },
      {
        singletonKey: `no_response:${message.id}`,
        startAfter: (settings?.noResponseDays ?? 7) * 86400_000,
      },
    );
  }
  return { sent: true, captured: sent.captured };
}

function sanitizeProviderError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown email provider error";
  return message
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(
      /\b(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi,
      "$1=[redacted]",
    )
    .slice(0, 240);
}

async function reschedule(
  database: Database,
  queue: JobQueue | undefined,
  messageId: string,
  scheduledFor: Date,
  reason: string,
) {
  await database
    .update(outreachMessages)
    .set({ status: "scheduled", scheduledFor, updatedAt: new Date() })
    .where(eq(outreachMessages.id, messageId));
  if (queue)
    await queue.enqueue(
      "outreach.send",
      { messageId },
      {
        singletonKey: `reschedule:${messageId}:${scheduledFor.getTime()}`,
        startAfter: scheduledFor,
      },
    );
  return { sent: false, reason, scheduledFor };
}
