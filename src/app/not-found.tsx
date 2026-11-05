import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-xl content-center gap-4 px-4 py-12 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
        Page not found
      </p>
      <h1 className="font-display text-3xl font-semibold">
        This place may have moved
      </h1>
      <p className="text-muted">
        Try browsing the directory to find its latest research page.
      </p>
      <Link
        className="mx-auto inline-flex min-h-11 items-center rounded-xl bg-accent px-5 font-semibold text-white hover:bg-accent-strong"
        href="/"
      >
        Back to discovery
      </Link>
    </main>
  );
}
