import Link from "next/link";
import { signInAction } from "@/app/actions";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="mx-auto grid min-h-[65vh] max-w-md content-center px-4 py-10">
      <div className="rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
          Welcome back
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Sign in</h1>
        {error ? (
          <p
            className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger"
            role="alert"
          >
            Invalid email or password.
          </p>
        ) : null}
        <form action={signInAction} className="mt-5 grid gap-3">
          {next ? <input name="next" type="hidden" value={next} /> : null}
          <label className="grid gap-1.5 text-sm font-semibold" htmlFor="email">
            Email
            <input
              autoComplete="email"
              className="min-h-11 rounded-xl border border-border px-3 font-normal"
              id="email"
              name="email"
              required
              type="email"
            />
          </label>
          <label
            className="grid gap-1.5 text-sm font-semibold"
            htmlFor="password"
          >
            Password
            <input
              autoComplete="current-password"
              className="min-h-11 rounded-xl border border-border px-3 font-normal"
              id="password"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="mt-2 min-h-11 rounded-xl bg-accent px-4 font-semibold text-white hover:bg-accent-strong"
            type="submit"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-xs text-muted">
          Demo account: user@demo.halalcheck.test · DemoUser!2026
        </p>
        <p className="mt-4 text-sm text-muted">
          <Link className="underline underline-offset-2" href="/sign-up">
            Create an account
          </Link>{" "}
          ·{" "}
          <Link className="underline underline-offset-2" href="/about">
            How this directory works
          </Link>
        </p>
      </div>
    </main>
  );
}
