import Link from "next/link";
import { SignInForm } from "@/components/account/SignInForm";

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
        <SignInForm demoMode={process.env.DEMO_MODE === "true"} next={next} />
        <p className="mt-4 text-sm text-muted">
          <Link className="underline underline-offset-2" href="/about">
            How this directory works
          </Link>
        </p>
      </div>
    </main>
  );
}
