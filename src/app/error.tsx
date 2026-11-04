"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-xl content-center gap-4 px-4 py-12 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
        A temporary interruption
      </p>
      <h1 className="font-display text-3xl font-semibold">
        We couldn’t load this page
      </h1>
      <p className="text-muted">
        Your research is safe. Please try again in a moment.
      </p>
      {process.env.NODE_ENV === "development" ? (
        <p className="break-words text-xs text-muted">{error.message}</p>
      ) : null}
      <button
        className="mx-auto min-h-11 rounded-xl bg-accent px-5 font-semibold text-white hover:bg-accent-strong"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </main>
  );
}
