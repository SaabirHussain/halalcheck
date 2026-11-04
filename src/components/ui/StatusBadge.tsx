import {
  BadgeCheck,
  CircleDashed,
  Clock3,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ResearchStatus } from "@/lib/shared/types";

const statusLabels: Record<ResearchStatus, string> = {
  not_researched: "Not researched",
  queued: "Research in progress · Queued",
  checking_public_sources: "Research in progress · Checking public sources",
  awaiting_outreach_approval: "Research in progress · Outreach approval",
  awaiting_business_response:
    "Research in progress · Awaiting business response",
  reviewing_evidence: "Research in progress · Reviewing evidence",
  findings_published: "Findings published",
  unable_to_confirm:
    "Unable to confirm — this is not a finding that the food is non-halal",
  needs_refresh: "Outdated — needs refresh",
};

const statusStyles: Record<ResearchStatus, string> = {
  not_researched: "bg-surface-2 text-ink",
  queued: "bg-info-soft text-info",
  checking_public_sources: "bg-info-soft text-info",
  awaiting_outreach_approval: "bg-info-soft text-info",
  awaiting_business_response: "bg-info-soft text-info",
  reviewing_evidence: "bg-info-soft text-info",
  findings_published: "bg-accent-soft text-accent-strong",
  unable_to_confirm: "bg-warn-soft text-warn",
  needs_refresh: "bg-warn-soft text-warn",
};

const statusIcons: Record<ResearchStatus, LucideIcon> = {
  not_researched: CircleDashed,
  queued: Clock3,
  checking_public_sources: Clock3,
  awaiting_outreach_approval: Clock3,
  awaiting_business_response: Clock3,
  reviewing_evidence: Clock3,
  findings_published: BadgeCheck,
  unable_to_confirm: TriangleAlert,
  needs_refresh: RefreshCw,
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: ResearchStatus | string;
  className?: string;
}) {
  const knownStatus =
    status in statusLabels ? (status as ResearchStatus) : null;

  if (!knownStatus) {
    return (
      <span
        className={`inline-flex min-h-8 items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted ${className}`}
      >
        <CircleDashed aria-hidden="true" size={15} />
        Unknown — not confirmed
      </span>
    );
  }

  const Icon = statusIcons[knownStatus];

  return (
    <span
      className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[knownStatus]} ${className}`}
    >
      <Icon aria-hidden="true" size={15} />
      {statusLabels[knownStatus]}
    </span>
  );
}
