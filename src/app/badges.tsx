const statusLabels: Record<string, string> = {
  not_researched: "Not researched",
  queued: "Research in progress · queued",
  checking_public_sources: "Research in progress · checking public sources",
  awaiting_outreach_approval: "Research in progress · outreach approval",
  awaiting_business_response: "Research in progress · awaiting business response",
  reviewing_evidence: "Research in progress · reviewing evidence",
  findings_published: "Findings published",
  unable_to_confirm: "Unable to confirm",
  needs_refresh: "Needs refresh",
};
const evidenceLabels: Record<string, string> = {
  restaurant_claim: "Restaurant reports",
  supplier_statement: "Supplier states",
  documentary_evidence: "Document reviewed",
  certification: "Certificate reviewed",
  owner_provided: "Owner-provided (reviewed)",
  public_website: "Business website states",
};
export function StatusBadge({ status }: { status: string }) {
  const variant = status === "findings_published" ? "published" : status === "unable_to_confirm" || status === "needs_refresh" ? "attention" : status === "not_researched" ? "neutral" : "progress";
  const icon = variant === "published" ? "✓" : variant === "attention" ? "!" : variant === "progress" ? "◷" : "○";
  return <span className={`status-badge ${variant}`}><span aria-hidden="true">{icon}</span> {statusLabels[status] ?? "Unknown — not confirmed"}</span>;
}
export function DemoBadge() {
  return <span className="demo-badge">Demo data</span>;
}
export function EvidenceLabel({ category }: { category: string }) {
  return <span className="evidence-label">{evidenceLabels[category] ?? "Unknown — not confirmed"}</span>;
}
