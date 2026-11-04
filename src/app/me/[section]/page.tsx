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
export default async function AccountPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { section } = await params;
  const title =
    (
      {
        saved: "Saved places",
        requests: "My research requests",
        notifications: "Notifications",
        settings: "Settings",
      } as Record<string, string>
    )[section] ?? "Your account";
  let rows: { id: string; label: string; detail: string; href: string }[] = [];
  if (section === "requests") {
    rows = await db
      .select({
        id: investigations.id,
        label: businesses.name,
        detail: investigations.status,
        href: branches.id,
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
  }
  if (section === "saved") {
    rows = await db
      .select({
        id: favorites.id,
        label: businesses.name,
        detail: branches.city,
        href: branches.id,
      })
      .from(favorites)
      .innerJoin(branches, eq(favorites.branchId, branches.id))
      .innerJoin(businesses, eq(branches.businessId, businesses.id))
      .where(eq(favorites.userId, user.id));
  }
  if (section === "notifications") {
    rows = await db
      .select({
        id: notifications.id,
        label: notifications.title,
        detail: notifications.body,
        href: notifications.link,
      })
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt));
  }
  return (
    <main className="page">
      <span className="eyebrow">Your account</span>
      <h1>{title}</h1>
      <nav className="admin-tabs">
        <Link href="/me/requests">Requests</Link>
        <Link href="/me/saved">Saved</Link>
        <Link href="/me/notifications">Notifications</Link>
        <Link href="/me/settings">Settings</Link>
      </nav>
      {section === "settings" ? (
        <div className="finding">
          <h2>Preferences</h2>
          <p>Manage email updates from your account profile.</p>
          <p>{user.email}</p>
        </div>
      ) : rows.length ? (
        rows.map((row) => (
          <article className="finding" key={row.id}>
            <Link
              href={row.href.startsWith("/") ? row.href : `/places/${row.href}`}
            >
              <h3>{row.label}</h3>
            </Link>
            <p className="muted">{row.detail}</p>
          </article>
        ))
      ) : (
        <div className="empty">
          Nothing here yet. Browse a place and request shared research.
        </div>
      )}
    </main>
  );
}
