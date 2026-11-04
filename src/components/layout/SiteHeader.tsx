import Link from "next/link";
import type { getCurrentUser } from "@/lib/auth/sessions";
import { signOutAction } from "@/app/actions";

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

function AlertCount({ count }: { count: number }) {
  if (!count) return null;

  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SiteHeader({
  user,
  unreadCount,
}: {
  user: CurrentUser;
  unreadCount: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-5 px-4 sm:px-6 lg:min-h-[4.5rem]">
        <Link
          className="shrink-0 text-xl font-extrabold tracking-tight text-accent-strong sm:text-2xl"
          href="/"
        >
          HalalCheck
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden flex-1 items-center gap-7 text-sm font-medium text-muted md:flex"
        >
          <Link className="transition hover:text-accent" href="/">
            Explore
          </Link>
          <Link className="transition hover:text-accent" href="/about">
            About
          </Link>
          <Link className="transition hover:text-accent" href="/me/requests">
            My research
          </Link>
          <Link
            className="inline-flex items-center transition hover:text-accent"
            href="/me/notifications"
          >
            Alerts <AlertCount count={unreadCount} />
          </Link>
        </nav>
        <div className="ml-auto">
          {user ? (
            <details className="group relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink hover:border-accent [&::-webkit-details-marker]:hidden">
                <span className="max-w-40 truncate">{user.displayName}</span>
                <span aria-hidden="true" className="text-muted">
                  ▾
                </span>
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 grid min-w-52 gap-1 rounded-2xl border border-border bg-surface p-2 shadow-xl">
                <Link
                  className="rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
                  href="/me/requests"
                >
                  My research
                </Link>
                {user.role === "admin" ? (
                  <Link
                    className="rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
                    href="/admin"
                  >
                    Admin workspace
                  </Link>
                ) : null}
                <form action={signOutAction} data-native-sign-out="true">
                  <button
                    className="min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2"
                    type="submit"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <Link
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold hover:border-accent"
              href="/sign-in"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
