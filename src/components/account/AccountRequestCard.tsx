import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ResearchStatus } from "@/lib/shared/types";

export function AccountRequestCard({
  businessName,
  branchName,
  branchId,
  status,
  stageDetail,
  outcome,
  requestedAt,
}: {
  businessName: string;
  branchName: string;
  branchId: string;
  status: ResearchStatus;
  stageDetail: string | null;
  outcome: string | null;
  requestedAt: Date;
}) {
  const bodyText =
    outcome === "cancelled by administrator"
      ? status === "findings_published"
        ? "This research request was closed; its published findings remain available."
        : "This research request was closed by an administrator."
      : status === "findings_published"
        ? "Findings have been published for this branch."
        : status === "unable_to_confirm"
          ? "Unable to confirm current findings. This is not a finding that the food is non-halal."
          : stageDetail;

  return (
    <article className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{businessName}</h2>
          <p className="text-sm text-muted">{branchName}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      {bodyText ? <p className="mt-3 text-sm text-muted">{bodyText}</p> : null}
      <p className="mt-3 text-xs text-muted">
        Requested{" "}
        {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
          requestedAt,
        )}
      </p>
      <Link
        className="mt-3 inline-flex min-h-10 items-center font-semibold text-accent underline underline-offset-2"
        href={`/places/${branchId}`}
      >
        View branch
      </Link>
    </article>
  );
}
