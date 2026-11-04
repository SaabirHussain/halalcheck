const evidenceLabels: Record<string, string> = {
  restaurant_claim: "Restaurant reports",
  supplier_statement: "Supplier states",
  documentary_evidence: "Document reviewed",
  certification: "Certificate reviewed",
  owner_provided: "Owner-provided (reviewed)",
  public_website: "Business website states",
};

export function EvidenceLabel({
  category,
  className = "",
}: {
  category: string | null | undefined;
  className?: string;
}) {
  return (
    <span className={`text-xs font-medium text-muted ${className}`}>
      {category
        ? (evidenceLabels[category] ?? "Unknown — not confirmed")
        : "Unknown — not confirmed"}
    </span>
  );
}
