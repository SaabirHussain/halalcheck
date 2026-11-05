import { SignUpForm } from "@/components/account/SignUpForm";

export default async function SignUp({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto grid min-h-[65vh] max-w-md content-center px-4 py-10">
      <div className="rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
          Join the community
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Create an account
        </h1>
        <p className="mt-2 text-sm text-muted">
          Follow research and save branches to revisit.
        </p>
        <SignUpForm next={next} />
      </div>
    </main>
  );
}
