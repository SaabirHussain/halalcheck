const researchStatusLabels: Record<string, string> = {
  not_researched: "Not researched",
  queued: "Queued",
  checking_public_sources: "Checking public sources",
  awaiting_outreach_approval: "Awaiting outreach approval",
  awaiting_business_response: "Awaiting business response",
  reviewing_evidence: "Reviewing evidence",
  findings_published: "Findings published",
  needs_refresh: "Outdated — needs refresh",
  unable_to_confirm:
    "Unable to confirm — this is not a finding that the food is non-halal",
};

const jobNameLabels: Record<string, string> = {
  "investigation.public_research": "Public research",
  "investigation.prepare_outreach": "Prepare outreach",
  "investigation.evidence_review": "Evidence review",
  "outreach.send": "Send outreach",
  "outreach.parse_reply": "Parse business reply",
  "outreach.no_response_check": "No-response check",
  "message.parse": "Parse inbound message",
  "notify.followers": "Notify followers",
  "investigations.reconcile": "Reconcile investigations",
  "refresh.scan": "Refresh scan",
};

const messageKindLabels: Record<string, string> = {
  initial: "Initial message",
  followup: "Follow-up message",
  reply: "Business reply",
  bounce: "Delivery notice",
  auto_reply: "Automatic reply",
};

const messageStatusLabels: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  captured: "Captured (not sent)",
  failed: "Failed",
  received: "Received",
  cancelled: "Cancelled",
};

const sourceKindLabels: Record<string, string> = {
  official_website: "Official website",
  supplier_site: "Supplier registry",
  certifier_registry: "Certifier registry",
  email_reply: "Business email reply",
};

const proposalStatusLabels: Record<string, string> = {
  pending: "Pending review",
  approved: "Published",
  rejected: "Rejected",
  closed: "Closed",
};

const auditActionLabels: Record<string, string> = {
  research_requested: "Research requested",
  research_joined: "Joined an investigation",
  investigation_paused: "Investigation paused",
  investigation_resumed: "Investigation resumed",
  investigation_cancelled: "Investigation cancelled",
  investigation_stage_retried: "Investigation stage retried",
  outreach_draft_created: "Outreach draft created",
  outreach_draft_edited: "Outreach draft edited",
  outreach_auto_approved: "Outreach automatically approved",
  outreach_approved: "Outreach approved",
  outreach_rejected: "Outreach rejected",
  outreach_send_retried: "Outreach send retried",
  outreach_send_failed: "Outreach send failed",
  outreach_settings_updated: "Outreach settings updated",
  contact_endpoint_added: "Contact endpoint added",
  contact_endpoint_approved: "Contact endpoint approved",
  contact_endpoint_rejected: "Contact endpoint rejected",
  contact_endpoint_ambiguous: "Contact endpoint marked ambiguous",
  contact_suppressed: "Contact suppressed",
  suppression_removed: "Suppression removed",
  certificate_accepted: "Certificate accepted",
  certificate_rejected: "Certificate rejected",
  certificate_pending: "Certificate returned to review",
  proposed_claim_edited: "Proposed finding edited",
  source_excerpt_updated: "Source review updated",
  findings_published: "Findings published",
  proposal_rejected: "Proposal rejected",
  correction_submitted: "Correction submitted",
  correction_accepted: "Correction accepted",
  correction_rejected: "Correction rejected",
  correction_converted_to_refresh: "Correction converted to refresh",
  unexpected_reply_received: "Unexpected reply received",
  unexpected_reply_assigned: "Unexpected reply assigned",
  unexpected_reply_dismissed: "Unexpected reply dismissed",
  inbound_reply_ingested: "Business reply received",
  outreach_bounce_received: "Outreach delivery failed",
  outreach_opt_out: "Business opted out of outreach",
  claim_conflict_detected: "Conflicting evidence detected",
  investigation_marked_unable_to_confirm:
    "Investigation marked unable to confirm",
  email_notification_preference_updated:
    "Email notification preference updated",
};

const entityTypeLabels: Record<string, string> = {
  investigation: "Investigation",
  job_run: "Job run",
  proposed_update: "Proposal",
  published_revision: "Published revision",
  outreach_message: "Outreach message",
  outreach_thread: "Outreach thread",
  contact_endpoint: "Contact endpoint",
  source: "Source",
  certificate: "Certificate",
  claim: "Finding",
  correction: "Correction",
  webhook_event: "Webhook event",
  unexpected_reply: "Unexpected reply",
  suppression: "Suppression",
  outreach_settings: "Outreach settings",
  user: "Account",
  branch: "Branch",
};

const productLabels: Record<string, string> = {
  chicken: "Chicken",
  beef: "Beef",
  lamb: "Lamb",
  goat: "Goat",
  turkey: "Turkey",
  other_meat: "Other meat",
  menu: "Menu",
  kitchen: "Kitchen",
  beverages: "Beverages",
  general: "General",
};

const attributeLabels: Record<string, string> = {
  supplier: "Supplier",
  slaughter_method: "Slaughter method",
  stunning: "Stunning",
  certifier: "Certifier",
  certificate: "Certificate",
  menu_coverage: "Menu coverage",
  separate_preparation: "Separate preparation",
  shared_grill: "Shared grill",
  shared_fryer: "Shared fryer",
  shared_utensils: "Shared utensils",
  shared_storage: "Shared storage",
  alcohol_served: "Alcohol served",
  pork_served: "Pork served",
  halal_status: "Halal status",
};

export function humanizeLabel(value: string): string {
  const words = value.replaceAll(".", " ").replaceAll("_", " ").split(/\s+/);
  const label = words
    .filter(Boolean)
    .map((word, index) =>
      index === 0
        ? `${word[0]?.toLocaleUpperCase() ?? ""}${word.slice(1)}`
        : word,
    )
    .join(" ");
  return label || "Unknown";
}

export function labelResearchStatus(value: string): string {
  return researchStatusLabels[value] ?? humanizeLabel(value);
}

export function labelJobName(value: string): string {
  return jobNameLabels[value] ?? humanizeLabel(value);
}

export function labelMessageKind(value: string): string {
  return messageKindLabels[value] ?? humanizeLabel(value);
}

export function labelMessageStatus(value: string): string {
  return messageStatusLabels[value] ?? humanizeLabel(value);
}

export function labelSourceKind(value: string): string {
  return sourceKindLabels[value] ?? humanizeLabel(value);
}

export function labelProposalStatus(value: string): string {
  return proposalStatusLabels[value] ?? humanizeLabel(value);
}

export function labelAuditAction(value: string): string {
  return auditActionLabels[value] ?? humanizeLabel(value);
}

export function labelEntityType(value: string): string {
  return entityTypeLabels[value] ?? humanizeLabel(value);
}

export function labelProduct(value: string): string {
  return productLabels[value] ?? humanizeLabel(value);
}

export function labelAttribute(value: string): string {
  return attributeLabels[value] ?? humanizeLabel(value);
}

export function formatAdminDate(
  value: Date | string | null | undefined,
): string {
  if (!value) return "Date unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unknown";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

export function formatAdminDateTime(
  value: Date | string | null | undefined,
): string {
  if (!value) return "Date unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unknown";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
