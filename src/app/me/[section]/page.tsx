import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  branches,
  businesses,
  favorites,
  investigationSubscriptions,
  investigations,
  notifications,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/sessions";
import { notFound } from "next/navigation";
import { listPublicBranches } from "@/lib/domain/public";
import { PlaceCard } from "@/components/discovery/PlaceCard";
import { AccountRequestCard } from "@/components/account/AccountRequestCard";
import {
  MarkAllNotificationsReadButton,
  NotificationCard,
} from "@/components/account/NotificationCard";
import { EmailNotificationsForm } from "@/components/account/EmailNotificationsForm";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const user = await getCurrentUser();
  const { section } = await params;
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/me/${section}`)}`);
  if (!["saved", "requests", "notifications", "settings"].includes(section)) {
    notFound();
  }
  const title =
    (
      {
        saved: "Saved places",
        requests: "My research requests",
        notifications: "Notifications",
        settings: "Settings",
      } as Record<string, string>
    )[section] ?? "Your account";
  if (section === "requests") {
    const rows = await db
      .select({
        id: investigations.id,
        businessName: businesses.name,
        branchName: branches.name,
        branchId: branches.id,
        status: investigations.status,
        stageDetail: investigations.stageDetail,
        outcome: investigations.outcome,
        requestedAt: investigationSubscriptions.createdAt,
      })
      .from(investigationSubscriptions)
      .innerJoin(
        investigations,
        eq(investigationSubscriptions.investigationId, investigations.id),
      )
      .innerJoin(branches, eq(investigations.branchId, branches.id))
      .innerJoin(businesses, eq(branches.businessId, businesses.id))
      .where(eq(investigationSubscriptions.userId, user.id))
      .orderBy(desc(investigations.createdAt));
    return (
      <main className="mx-auto min-w-0 max-w-5xl px-4 py-8 sm:px-6">
        <AccountNavigation title={title} />
        <div className="mt-6 grid gap-3">
          {rows.length ? (
            rows.map((row) => (
              <AccountRequestCard
                branchId={row.branchId}
                branchName={row.branchName}
                businessName={row.businessName}
                key={row.id}
                requestedAt={row.requestedAt}
                outcome={row.outcome}
                stageDetail={row.stageDetail}
                status={row.status}
              />
            ))
          ) : (
            <EmptyAccountState>
              You are not following any investigations yet.
            </EmptyAccountState>
          )}
        </div>
      </main>
    );
  }
  if (section === "saved") {
    const savedRows = await db
      .select({
        branchId: favorites.branchId,
      })
      .from(favorites)
      .innerJoin(branches, eq(favorites.branchId, branches.id))
      .innerJoin(businesses, eq(branches.businessId, businesses.id))
      .where(eq(favorites.userId, user.id));
    const places = await listPublicBranches({ limit: 300 });
    const savedIds = new Set(savedRows.map((row) => row.branchId));
    const savedPlaces = places.filter((place) => savedIds.has(place.id));
    return (
      <main className="mx-auto min-w-0 max-w-7xl px-4 py-8 sm:px-6">
        <AccountNavigation title={title} />
        {savedPlaces.length ? (
          <section
            aria-label="Saved places"
            className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {savedPlaces.map((place) => (
              <PlaceCard
                highlighted={false}
                key={place.id}
                onHighlight={() => undefined}
                place={place}
              />
            ))}
          </section>
        ) : (
          <EmptyAccountState>
            Saved places will appear here when you save a branch.
          </EmptyAccountState>
        )}
      </main>
    );
  }
  if (section === "notifications") {
    const rows = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        link: notifications.link,
        branchName: branches.name,
        businessName: businesses.name,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .leftJoin(branches, eq(notifications.branchId, branches.id))
      .leftJoin(businesses, eq(branches.businessId, businesses.id))
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt));
    return (
      <main className="mx-auto min-w-0 max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <AccountNavigation title={title} />
          {rows.some((row) => !row.readAt) ? (
            <MarkAllNotificationsReadButton />
          ) : null}
        </div>
        <div className="mt-6 grid min-w-0 gap-3">
          {rows.length ? (
            rows.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
              />
            ))
          ) : (
            <EmptyAccountState>
              Research updates and important changes will appear here.
            </EmptyAccountState>
          )}
        </div>
      </main>
    );
  }
  if (section === "settings") {
    return (
      <main className="mx-auto min-w-0 max-w-5xl px-4 py-8 sm:px-6">
        <AccountNavigation title={title} />
        <section className="mt-6 rounded-card border border-border bg-surface p-5">
          <p className="text-sm text-muted">{user.email}</p>
          <h2 className="mt-3 font-display text-xl font-semibold">
            Email notifications
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Choose whether you’d like captured email updates when research is
            published.
          </p>
          <EmailNotificationsForm enabled={user.emailNotifications} />
        </section>
      </main>
    );
  }
  return null;
}

function AccountNavigation({ title }: { title: string }) {
  return (
    <header className="min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
        Your account
      </span>
      <h1 className="mt-1 font-display text-3xl font-semibold">{title}</h1>
      <nav
        aria-label="Account navigation"
        className="mt-4 flex min-w-0 max-w-full gap-2 overflow-x-auto border-b border-border pb-3"
      >
        <Link
          className="min-h-10 shrink-0 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold"
          href="/me/requests"
        >
          Requests
        </Link>
        <Link
          className="min-h-10 shrink-0 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold"
          href="/me/saved"
        >
          Saved
        </Link>
        <Link
          className="min-h-10 shrink-0 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold"
          href="/me/notifications"
        >
          Notifications
        </Link>
        <Link
          className="min-h-10 shrink-0 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold"
          href="/me/settings"
        >
          Settings
        </Link>
      </nav>
    </header>
  );
}

function EmptyAccountState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-card border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
      {children}
      <p className="mt-2">
        <Link className="font-semibold text-accent underline" href="/">
          Explore places
        </Link>
      </p>
    </div>
  );
}
