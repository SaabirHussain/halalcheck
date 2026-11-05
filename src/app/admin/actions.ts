"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  claims,
  contactEndpoints,
  outreachMessages,
  outreachThreads,
} from "@/db/schema";
import { proposedUpdates } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { InlineJobQueue } from "@/lib/jobs/memory";
import { getRuntimeQueue } from "@/lib/jobs/runtime";
import type { JobQueue } from "@/lib/jobs/types";
import { isWorkerRunning } from "@/lib/jobs/worker-presence";
import {
  pauseInvestigation,
  resumeInvestigation,
  cancelInvestigation,
  retryFailedStage,
} from "@/lib/domain/investigations";
import {
  addSuppression,
  approveOutreachMessage,
  rejectOutreachMessage,
  retryFailedOutreachSend,
  setOutreachSettings,
} from "@/lib/domain/outreach";
import { ingestInboundEmail } from "@/lib/domain/inbound-email";
import { buildJobHandlers } from "@/worker/handlers";
import {
  addContactEndpoint,
  assignUnexpectedReply,
  convertCorrectionToRefresh,
  dismissUnexpectedReply,
  editOutreachDraft,
  editProposedClaim,
  removeSuppression,
  reviewCertificate,
  reviewContactEndpoint,
  updateSourceExcerpt,
} from "@/lib/domain/admin";
import {
  publishProposedUpdate,
  rejectProposedUpdate,
} from "@/lib/domain/publishing";
import { reviewCorrection } from "@/lib/domain/corrections";
import { refreshScan } from "@/lib/domain/refresh";

function actorFor(user: { id: string }) {
  return { type: "admin" as const, userId: user.id };
}

export async function pauseInvestigationAction(form: FormData) {
  const user = await requireAdmin();
  await pauseInvestigation(
    actorFor(user),
    String(form.get("investigationId") ?? ""),
    db,
  );
  revalidatePath("/admin");
}

export async function resumeInvestigationAction(form: FormData) {
  const user = await requireAdmin();
  await resumeInvestigation(
    actorFor(user),
    String(form.get("investigationId") ?? ""),
    await getRuntimeQueue(),
    db,
  );
  revalidatePath("/admin");
}

export async function cancelInvestigationAction(form: FormData) {
  const user = await requireAdmin();
  await cancelInvestigation(
    actorFor(user),
    String(form.get("investigationId") ?? ""),
    db,
  );
  revalidatePath("/admin");
}

export async function retryJobAction(form: FormData) {
  const user = await requireAdmin();
  await retryFailedStage(
    actorFor(user),
    String(form.get("jobRunId") ?? ""),
    await getRuntimeQueue(),
    db,
  );
  revalidatePath("/admin");
}

export async function approveDraftAdminAction(form: FormData) {
  const user = await requireAdmin();
  await approveOutreachMessage(
    actorFor(user),
    String(form.get("messageId") ?? ""),
    await getRuntimeQueue(),
    db,
    { approveContact: form.get("approveContact") === "on" },
  );
  revalidatePath("/admin");
}

export async function rejectDraftAdminAction(form: FormData) {
  const user = await requireAdmin();
  await rejectOutreachMessage(
    actorFor(user),
    String(form.get("messageId") ?? ""),
    db,
  );
  revalidatePath("/admin");
}

export async function retryOutreachSendAction(form: FormData) {
  const user = await requireAdmin();
  await retryFailedOutreachSend(
    actorFor(user),
    String(form.get("messageId") ?? ""),
    await getRuntimeQueue(),
    db,
  );
  revalidatePath("/admin");
}

export async function updateOutreachSettingsAction(form: FormData) {
  const user = await requireAdmin();
  await setOutreachSettings(
    actorFor(user),
    {
      mode:
        form.get("mode") === "auto_send_approved"
          ? "auto_send_approved"
          : "manual_approval",
      maxFollowups: Number(form.get("maxFollowups")),
      minDaysBetweenMessages: Number(form.get("minDaysBetweenMessages")),
      maxMessagesPerBusiness30d: Number(form.get("maxMessagesPerBusiness30d")),
      noResponseDays: Number(form.get("noResponseDays")),
      paused: form.get("paused") === "on",
    },
    db,
  );
  revalidatePath("/admin");
}

export async function emergencyPauseAction(form: FormData) {
  const user = await requireAdmin();
  if (form.get("confirm") !== "on") {
    throw new Error("Confirm the emergency pause before saving.");
  }
  await setOutreachSettings(
    actorFor(user),
    { paused: form.get("paused") === "true" },
    db,
  );
  revalidatePath("/admin");
}

export async function simulateInboundReplyAction(form: FormData) {
  const user = await requireAdmin();
  const investigationId = String(form.get("investigationId") ?? "");
  const eventId = randomUUID();
  const workerRunning = await isWorkerRunning();
  let queue: JobQueue;
  if (workerRunning) {
    queue = await getRuntimeQueue();
  } else {
    const inlineQueue = new InlineJobQueue();
    for (const [name, handler] of Object.entries(
      buildJobHandlers(db, inlineQueue),
    )) {
      inlineQueue.register(name, handler);
    }
    queue = inlineQueue;
  }
  const [thread] = await db
    .select({
      id: outreachThreads.id,
      token: outreachThreads.threadToken,
      contactEndpointId: outreachThreads.contactEndpointId,
    })
    .from(outreachThreads)
    .where(eq(outreachThreads.investigationId, investigationId))
    .orderBy(desc(outreachThreads.createdAt))
    .limit(1);
  if (!thread)
    throw new Error("No outreach thread exists for this investigation.");
  const [lastOutbound] = await db
    .select({ messageIdHeader: outreachMessages.messageIdHeader })
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.threadId, thread.id),
        eq(outreachMessages.direction, "outbound"),
      ),
    )
    .orderBy(desc(outreachMessages.sequence))
    .limit(1);
  const [endpoint] = await db
    .select({ value: contactEndpoints.value })
    .from(contactEndpoints)
    .where(eq(contactEndpoints.id, thread.contactEndpointId ?? ""))
    .limit(1);
  await ingestInboundEmail(
    actorFor(user),
    {
      provider: "simulator",
      eventId,
      from: endpoint?.value ?? "business@demo.halalcheck.test",
      to: `reply+${thread.token}@demo.halalcheck.test`,
      subject: "Simulated business reply",
      text: String(form.get("reply") ?? "").slice(0, 10000),
      messageId: `<${randomUUID()}@simulator.demo.halalcheck.test>`,
      inReplyTo: lastOutbound?.messageIdHeader ?? null,
      receivedAt: new Date(),
    },
    queue,
    db,
  );
  revalidatePath(`/admin/investigations/${investigationId}`);
  redirect(
    `/admin/investigations/${investigationId}?simulated=${eventId}${workerRunning ? "" : "&inline=true"}`,
  );
}

export async function editDraftAdminAction(form: FormData) {
  const user = await requireAdmin();
  await editOutreachDraft(
    actorFor(user),
    String(form.get("messageId") ?? ""),
    {
      subject: String(form.get("subject") ?? ""),
      bodyText: String(form.get("bodyText") ?? ""),
      questions: form.getAll("questions").map(String),
    },
    db,
  );
  revalidatePath("/admin");
}

export async function updateSourceAdminAction(form: FormData) {
  const user = await requireAdmin();
  await updateSourceExcerpt(
    actorFor(user),
    String(form.get("sourceId") ?? ""),
    {
      publicExcerpt: String(form.get("publicExcerpt") ?? ""),
      isPublic: form.get("isPublic") === "on",
    },
    db,
  );
  revalidatePath("/admin");
}

export async function reviewContactAdminAction(form: FormData) {
  const user = await requireAdmin();
  const status = String(form.get("status"));
  if (!["approved", "rejected", "ambiguous"].includes(status)) {
    throw new Error("Invalid contact review status.");
  }
  await reviewContactEndpoint(
    actorFor(user),
    String(form.get("endpointId") ?? ""),
    status as "approved" | "rejected" | "ambiguous",
    db,
  );
  revalidatePath("/admin");
}

export async function addContactAdminAction(form: FormData) {
  const user = await requireAdmin();
  const kind = String(form.get("kind"));
  if (!["email", "phone", "web_form"].includes(kind)) {
    throw new Error("Invalid contact kind.");
  }
  await addContactEndpoint(
    actorFor(user),
    {
      branchId: String(form.get("branchId") ?? ""),
      value: String(form.get("value") ?? ""),
      kind: kind as "email" | "phone" | "web_form",
      notes: String(form.get("notes") ?? ""),
      isPersonal: form.get("isPersonal") === "on",
    },
    db,
  );
  revalidatePath("/admin");
}

export async function reviewCertificateAdminAction(form: FormData) {
  const user = await requireAdmin();
  const coverage = String(form.get("coversBranch") ?? "");
  await reviewCertificate(
    actorFor(user),
    String(form.get("certificateId") ?? ""),
    {
      status: form.get("status") === "accepted" ? "accepted" : "rejected",
      validFrom: String(form.get("validFrom") ?? "") || null,
      validUntil: String(form.get("validUntil") ?? "") || null,
      coversBranch: coverage === "" ? null : coverage === "true",
    },
    db,
  );
  revalidatePath("/admin/certificates");
}

export async function editProposedClaimAdminAction(form: FormData) {
  const user = await requireAdmin();
  await editProposedClaim(
    actorFor(user),
    String(form.get("claimId") ?? ""),
    String(form.get("value") ?? ""),
    db,
  );
  revalidatePath("/admin/proposals");
}

export async function publishProposalAdminAction(form: FormData) {
  const user = await requireAdmin();
  const proposalId = String(form.get("proposalId") ?? "");
  const proposal = await db.query.proposedUpdates.findFirst({
    where: eq(proposedUpdates.id, proposalId),
  });
  if (!proposal) throw new Error("Proposal not found.");
  const proposedClaims = await db
    .select({ id: claims.id })
    .from(claims)
    .where(eq(claims.proposedUpdateId, proposalId));
  const approvedClaimIds = proposedClaims.flatMap((claim) =>
    form.get(`decision-${claim.id}`) === "approve" ? [claim.id] : [],
  );
  const rejectedClaimIds = proposedClaims.flatMap((claim) =>
    form.get(`decision-${claim.id}`) === "reject" ? [claim.id] : [],
  );
  const queue = await getRuntimeQueue();
  await publishProposedUpdate(
    actorFor(user),
    proposalId,
    {
      approvedClaimIds,
      rejectedClaimIds,
      publicSummary: String(form.get("publicSummary") ?? ""),
      changeSummary: String(form.get("changeSummary") ?? ""),
      confirmedMaterialChangeIds: form
        .getAll("materialChangeConfirmed")
        .map(String),
    },
    queue,
    db,
  );
  revalidatePath("/admin/proposals");
  redirect(`/places/${proposal.branchId}`);
}

export async function rejectProposalAdminAction(form: FormData) {
  const user = await requireAdmin();
  await rejectProposedUpdate(
    actorFor(user),
    String(form.get("proposalId") ?? ""),
    db,
  );
  revalidatePath("/admin/proposals");
}

export async function closeProposalUnableToConfirmAction(form: FormData) {
  const user = await requireAdmin();
  const proposalId = String(form.get("proposalId") ?? "");
  const proposal = await db.query.proposedUpdates.findFirst({
    where: eq(proposedUpdates.id, proposalId),
  });
  if (!proposal) throw new Error("Proposal not found.");
  const proposedClaims = await db
    .select({ id: claims.id })
    .from(claims)
    .where(eq(claims.proposedUpdateId, proposalId));
  await publishProposedUpdate(
    actorFor(user),
    proposalId,
    {
      approvedClaimIds: [],
      rejectedClaimIds: proposedClaims.map((claim) => claim.id),
      publicSummary:
        "We could not confirm current findings. This is not a finding that the food is non-halal.",
      changeSummary: "The review could not confirm current findings.",
    },
    await getRuntimeQueue(),
    db,
  );
  revalidatePath("/admin/proposals");
  redirect(`/places/${proposal.branchId}`);
}

export async function reviewCorrectionAdminAction(form: FormData) {
  const user = await requireAdmin();
  const decision = String(form.get("decision"));
  if (decision !== "accepted" && decision !== "rejected") {
    throw new Error("Invalid correction decision.");
  }
  await reviewCorrection(
    actorFor(user),
    String(form.get("correctionId") ?? ""),
    decision,
    String(form.get("adminNote") ?? ""),
    db,
  );
  revalidatePath("/admin/corrections");
}

export async function convertCorrectionAdminAction(form: FormData) {
  const user = await requireAdmin();
  await convertCorrectionToRefresh(
    actorFor(user),
    String(form.get("correctionId") ?? ""),
    await getRuntimeQueue(),
    db,
  );
  revalidatePath("/admin/corrections");
}

export async function removeSuppressionAdminAction(form: FormData) {
  const user = await requireAdmin();
  await removeSuppression(
    actorFor(user),
    String(form.get("suppressionId") ?? ""),
    db,
  );
  revalidatePath("/admin/outreach");
}

export async function addSuppressionAdminAction(form: FormData) {
  const user = await requireAdmin();
  const kind = form.get("kind") === "domain" ? "domain" : "email";
  await addSuppression(
    actorFor(user),
    {
      value: String(form.get("value") ?? ""),
      kind,
      reason: "manual",
      note: String(form.get("note") ?? ""),
    },
    db,
  );
  revalidatePath("/admin/outreach");
}

export async function dismissUnexpectedReplyAdminAction(form: FormData) {
  const user = await requireAdmin();
  await dismissUnexpectedReply(
    actorFor(user),
    String(form.get("replyId") ?? ""),
    db,
  );
  revalidatePath("/admin/outreach");
}

export async function assignUnexpectedReplyAdminAction(form: FormData) {
  const user = await requireAdmin();
  await assignUnexpectedReply(
    actorFor(user),
    String(form.get("replyId") ?? ""),
    String(form.get("threadId") ?? ""),
    await getRuntimeQueue(),
    db,
  );
  revalidatePath("/admin/outreach");
}

export async function runRefreshScanAction() {
  await requireAdmin();
  await refreshScan({ type: "worker" }, await getRuntimeQueue(), db);
  revalidatePath("/admin/refresh");
}
