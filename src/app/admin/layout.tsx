import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-semibold">403 · Forbidden</h1>
        <p className="mt-2 text-muted">
          Administrator access is required for this area.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-semibold text-white"
          href="/sign-in?next=%2Fadmin"
        >
          Sign in as an administrator
        </Link>
      </main>
    );
  }
  return (
    <main className="mx-auto grid min-w-0 max-w-[90rem] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
          Operations
        </span>
        <h1 className="mt-1 font-display text-2xl font-semibold">
          Admin workspace
        </h1>
        <nav
          aria-label="Admin navigation"
          className="mt-4 flex min-w-0 max-w-full gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible"
        >
          <Link
            className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            href="/admin"
          >
            Overview
          </Link>
          <Link
            className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            href="/admin/investigations"
          >
            Investigations
          </Link>
          <Link
            className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            href="/admin/outreach"
          >
            Outreach
          </Link>
          <Link
            className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            href="/admin/proposals"
          >
            Proposals
          </Link>
          <Link
            className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            href="/admin/certificates"
          >
            Certificates
          </Link>
          <Link
            className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            href="/admin/corrections"
          >
            Corrections
          </Link>
          <Link
            className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            href="/admin/refresh"
          >
            Refresh
          </Link>
          <Link
            className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            href="/admin/audit"
          >
            Audit log
          </Link>
        </nav>
      </aside>
      <section className="min-w-0">{children}</section>
    </main>
  );
}
