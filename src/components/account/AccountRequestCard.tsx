import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ResearchStatus } from "@/lib/shared/types";

export function AccountRequestCard({
  businessName,
  branchName,
  branchId,
  status,
  stageDetail,
  requestedAt,
}: {
  businessName: string;
  branchName: string;
  branchId: string;
  status: ResearchStatus;
  stageDetail: string | null;
  requestedAt: Date;
}) {
  return (
    <article className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{businessName}</h2>
          <p className="text-sm text-muted">{branchName}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      {stageDetail ? (
        <p className="mt-3 text-sm text-muted">{stageDetail}</p>
      ) : null}
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
