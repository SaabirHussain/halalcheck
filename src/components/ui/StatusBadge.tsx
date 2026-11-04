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

const statusIcons: Record<ResearchStatus, string> = {
  not_researched: "○",
  queued: "◷",
  checking_public_sources: "◷",
  awaiting_outreach_approval: "◷",
  awaiting_business_response: "◷",
  reviewing_evidence: "◷",
  findings_published: "✓",
  unable_to_confirm: "!",
  needs_refresh: "↻",
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
        <span aria-hidden="true">○</span>
        Unknown — not confirmed
      </span>
    );
  }

  return (
    <span
      className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[knownStatus]} ${className}`}
    >
      <span aria-hidden="true">{statusIcons[knownStatus]}</span>
      {statusLabels[knownStatus]}
    </span>
  );
}
