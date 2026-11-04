"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db";
import { authenticateUser } from "@/lib/auth/service";
import { getCurrentUser } from "@/lib/auth/sessions";
import { getRuntimeQueue } from "@/lib/jobs/runtime";
import { requestResearch } from "@/lib/domain/research-requests";
import { requireAdmin } from "@/lib/auth/guards";
import { approveOutreachMessage } from "@/lib/domain/outreach";
import { outreachThreads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ingestInboundEmail } from "@/lib/domain/inbound-email";
import { submitCorrection } from "@/lib/domain/corrections";
import { registerUser } from "@/lib/auth/service";
import { followBranch, toggleFavorite } from "@/lib/domain/corrections";
import { revokeCurrentSession } from "@/lib/auth/sessions";
import type { Actor } from "@/lib/domain/actor";

export type PlaceActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  following?: boolean;
  favorited?: boolean;
};

async function requestIp() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown"
  ).slice(0, 64);
}

function toActor(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
): Actor {
  return { type: user.role === "admin" ? "admin" : "user", userId: user.id };
}

export async function signInAction(form: FormData) {
  const next = String(form.get("next") ?? "/");
  const redirectTo =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";
  try {
    await authenticateUser(
      String(form.get("email") ?? ""),
      String(form.get("password") ?? ""),
      await requestIp(),
      db,
    );
  } catch {
    redirect(`/sign-in?error=1&next=${encodeURIComponent(redirectTo)}`);
  }
  redirect(redirectTo);
}

export async function requestResearchAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const queue = await getRuntimeQueue();
  await requestResearch(
    toActor(user),
    String(form.get("branchId") ?? ""),
    queue,
    db,
  );
  redirect("/me/requests");
}

export async function requestResearchFromPlaceAction(
  _previous: PlaceActionState,
  form: FormData,
): Promise<PlaceActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sign in to follow this investigation." };
  }
  try {
    await requestResearch(
      toActor(user),
      String(form.get("branchId") ?? ""),
      await getRuntimeQueue(),
      db,
    );
    return {
      ok: true,
      following: true,
      message: "You’re following this investigation.",
    };
  } catch {
    return {
      error: "We couldn’t update your research request. Please try again.",
    };
  }
}

export async function followBranchFromPlaceAction(
  _previous: PlaceActionState,
  form: FormData,
): Promise<PlaceActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sign in to follow this place." };
  }
  try {
    const result = await followBranch(
      toActor(user),
      String(form.get("branchId") ?? ""),
      db,
    );
    return {
      ok: true,
      following: true,
      message: result.followed
        ? "You’re following this place."
        : "You already follow this place.",
    };
  } catch {
    return { error: "We couldn’t update your follow. Please try again." };
  }
}

export async function toggleFavoriteFromPlaceAction(
  _previous: PlaceActionState,
  form: FormData,
): Promise<PlaceActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sign in to save this place." };
  }
  try {
    const result = await toggleFavorite(
      toActor(user),
      String(form.get("branchId") ?? ""),
      db,
    );
    return {
      ok: true,
      favorited: result.favorited,
      message: result.favorited
        ? "Place saved."
        : "Place removed from saved places.",
    };
  } catch {
    return { error: "We couldn’t update your saved places. Please try again." };
  }
}

export async function signOutAction() {
  await revokeCurrentSession(db);
  redirect("/");
}

export async function approveDraftAction(form: FormData) {
  const admin = await requireAdmin();
  const queue = await getRuntimeQueue();
  await approveOutreachMessage(
    { type: "admin", userId: admin.id },
    String(form.get("messageId") ?? ""),
    queue,
    db,
    { approveContact: form.get("approveContact") === "on" },
  );
  redirect("/admin/outreach");
}

export async function simulateReplyAction(form: FormData) {
  const admin = await requireAdmin();
  void admin;
  const investigationId = String(form.get("investigationId") ?? "");
  const [thread] = await db
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.investigationId, investigationId))
    .limit(1);
  if (!thread) throw new Error("No demo outreach thread.");
  await ingestInboundEmail(
    { type: "system" },
    {
      provider: "demo",
      eventId: `sim-${crypto.randomUUID()}`,
      from: "business@demo.halalcheck.test",
      to: `reply+${thread.threadToken}@demo.halalcheck.test`,
      subject: "Re: HalalCheck research",
      text: String(form.get("reply") ?? "All our meat is halal."),
      messageId: `<sim-${crypto.randomUUID()}@demo.halalcheck.test>`,
      receivedAt: new Date(),
    },
    await getRuntimeQueue(),
    db,
  );
  redirect(`/admin/investigations/${investigationId}`);
}

export async function correctionAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const branchId = String(form.get("branchId") ?? "");
  const file = form.get("file");
  await submitCorrection(toActor(user), branchId, {
    body: String(form.get("body") ?? ""),
    url: String(form.get("url") ?? "") || null,
    isOwnerSubmission: form.get("isOwnerSubmission") === "on",
    file: file instanceof File && file.size > 0 ? file : null,
  });
  redirect(`/places/${branchId}`);
}

export async function signUpAction(form: FormData) {
  try {
    await registerUser(
      String(form.get("email") ?? ""),
      String(form.get("password") ?? ""),
      String(form.get("displayName") ?? ""),
      await requestIp(),
      db,
    );
  } catch {
    redirect("/sign-up?error=1");
  }
  redirect("/");
}
