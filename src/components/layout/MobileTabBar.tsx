import Link from "next/link";
import {
  Bell,
  Bookmark,
  Compass,
  ClipboardList,
  UserRound,
} from "lucide-react";
import type { getCurrentUser } from "@/lib/auth/sessions";

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

export function MobileTabBar({
  user,
  unreadCount,
}: {
  user: CurrentUser;
  unreadCount: number;
}) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_18px_rgb(30_36_32/0.06)] backdrop-blur md:hidden"
    >
      <Link
        className="grid min-h-11 place-items-center content-center gap-0.5 rounded-lg text-[0.68rem] font-medium text-muted hover:bg-surface-2"
        href="/"
      >
        <Compass aria-hidden="true" size={19} />
        <span>Discover</span>
      </Link>
      <Link
        className="grid min-h-11 place-items-center content-center gap-0.5 rounded-lg text-[0.68rem] font-medium text-muted hover:bg-surface-2"
        href={user ? "/me/saved" : "/sign-in?next=%2Fme%2Fsaved"}
      >
        <Bookmark aria-hidden="true" size={19} />
        <span>Saved</span>
      </Link>
      <Link
        className="grid min-h-11 place-items-center content-center gap-0.5 rounded-lg text-[0.68rem] font-medium text-muted hover:bg-surface-2"
        href={user ? "/me/requests" : "/sign-in?next=%2Fme%2Frequests"}
      >
        <ClipboardList aria-hidden="true" size={19} />
        <span>Requests</span>
      </Link>
      <Link
        className="grid min-h-11 place-items-center content-center gap-0.5 rounded-lg text-[0.68rem] font-medium text-muted hover:bg-surface-2"
        href={
          user ? "/me/notifications" : "/sign-in?next=%2Fme%2Fnotifications"
        }
      >
        <span className="relative">
          <Bell aria-hidden="true" size={19} />
          {unreadCount > 0 ? (
            <span className="absolute -right-2 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.6rem] text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </span>
        <span>Alerts</span>
      </Link>
      <Link
        className="grid min-h-11 place-items-center content-center gap-0.5 rounded-lg text-[0.68rem] font-medium text-muted hover:bg-surface-2"
        href={user ? "/me/settings" : "/sign-in"}
      >
        <UserRound aria-hidden="true" size={19} />
        <span>Account</span>
      </Link>
    </nav>
  );
}
