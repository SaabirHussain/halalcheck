import { redirect } from "next/navigation";
import { CorrectionForm } from "@/components/account/CorrectionForm";
import { getCurrentUser } from "@/lib/auth/sessions";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/places/${id}/report`)}`);
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
        Community correction
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold">
        Suggest a correction
      </h1>
      <p className="mb-5 mt-2 text-sm text-muted">
        Share a detail or source for the review team. Submissions are reviewed
        before they affect public findings.
      </p>
      <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
        <CorrectionForm branchId={id} />
      </section>
    </main>
  );
}
