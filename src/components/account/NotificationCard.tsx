import Link from "next/link";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions";

export type AccountNotification = {
  id: string;
  title: string;
  body: string;
  link: string;
  branchName: string | null;
  businessName: string | null;
  createdAt: Date;
  readAt: Date | null;
};

export function NotificationCard({
  notification,
}: {
  notification: AccountNotification;
}) {
  return (
    <article
      className={`min-w-0 rounded-card border p-4 ${
        notification.readAt
          ? "border-border bg-surface"
          : "border-accent/30 bg-accent-soft"
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 break-words">
          <p className="text-xs text-muted">
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(notification.createdAt)}
            {!notification.readAt ? (
              <span className="ml-2 font-bold text-accent">Unread</span>
            ) : null}
          </p>
          <h2 className="mt-1 font-semibold">{notification.title}</h2>
          {notification.businessName ? (
            <p className="mt-1 text-sm font-semibold text-ink">
              {notification.businessName}
              {notification.branchName ? ` · ${notification.branchName}` : ""}
            </p>
          ) : null}
          <p className="mt-1 break-words text-sm text-muted">
            {notification.body}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Link
            className="inline-flex min-h-10 items-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold"
            href={notification.link}
          >
            View
          </Link>
          {!notification.readAt ? (
            <form action={markNotificationReadAction}>
              <input
                name="notificationId"
                type="hidden"
                value={notification.id}
              />
              <button className="min-h-10 rounded-lg px-3 text-sm font-semibold text-accent">
                Mark read
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function MarkAllNotificationsReadButton() {
  return (
    <form action={markAllNotificationsReadAction}>
      <button className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm font-semibold">
        Mark all read
      </button>
    </form>
  );
}
