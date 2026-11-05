import Link from "next/link";
import { and, asc, desc, eq, gte, lte, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  branches,
  businesses,
  certificates,
  certifiers,
  corrections,
  emailOutbox,
  investigations,
  outreachMessages,
  outreachSettings,
  outreachThreads,
  proposedUpdates,
  suppressions,
  unexpectedReplies,
  users,
} from "@/db/schema";
import {
  formatAdminDate,
  formatAdminDateTime,
  humanizeLabel,
  labelAuditAction,
  labelEntityType,
  labelJobName,
  labelMessageKind,
  labelProposalStatus,
  labelResearchStatus,
} from "@/lib/labels";
import {
  hydrateAdminBranchRows,
  loadAdminPlaceReferences,
} from "@/lib/domain/admin-place-references";
import {
  addSuppressionAdminAction,
  assignUnexpectedReplyAdminAction,
  approveDraftAdminAction,
  dismissUnexpectedReplyAdminAction,
  emergencyPauseAction,
  removeSuppressionAdminAction,
  reviewCertificateAdminAction,
  rejectDraftAdminAction,
  runRefreshScanAction,
  updateOutreachSettingsAction,
} from "../actions";

type AdminRow = {
  id: string;
  label: string;
  detail?: string | null;
  href?: string;
  action?: "draft" | "retry" | "certificate" | "correction";
  googleMapsUrl?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  coversBranch?: boolean | null;
  certificateStatus?: string;
};

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

const panel = "rounded-card border border-border bg-surface p-4 shadow-sm";
const privateMetadataKey =
  /(email|phone|address|token|secret|password|message|body|raw|content|excerpt|authorization)/i;
const privateMetadataValue =
  /(?:bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|(?:api[_-]?key|token|secret)\s*[:=]\s*\S+)/i;

export default async function AdminSection({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{
    page?: string;
    entityType?: string;
    action?: string;
    status?: string;
  }>;
}) {
  const { section } = await params;
  const filters = await searchParams;
  let rows: AdminRow[] = [];
  let settings: typeof outreachSettings.$inferSelect | undefined;
  let suppressionRows: (typeof suppressions.$inferSelect)[] = [];
  let unexpectedRows: (typeof unexpectedReplies.$inferSelect)[] = [];
  let threadOptions: { id: string; label: string }[] = [];
  let auditRows: AuditRow[] = [];
  let entityTypeOptions: string[] = [];
  let actionOptions: string[] = [];
  let auditHasNextPage = false;
  const auditPage = Math.max(1, Number(filters.page) || 1);

  if (section === "investigations") {
    const status = filters.status;
    const branchRows = await hydrateAdminBranchRows(
      await db
        .select({
          id: investigations.id,
          branchId: branches.id,
          detailsSource: branches.detailsSource,
          address: branches.address,
          city: branches.city,
          status: investigations.status,
          stage: investigations.stageDetail,
          kind: investigations.kind,
          business: businesses.name,
          branch: branches.name,
        })
        .from(investigations)
        .innerJoin(branches, eq(investigations.branchId, branches.id))
        .innerJoin(businesses, eq(branches.businessId, businesses.id))
        .where(
          status
            ? eq(
                investigations.status,
                status as typeof investigations.$inferSelect.status,
              )
            : undefined,
        )
        .orderBy(desc(investigations.updatedAt))
    );
    rows = branchRows.map((row) => ({
      id: row.id,
      label: row.branch ? `${row.business} · ${row.branch}` : row.business,
      detail: `${row.kind === "refresh" ? "Refresh investigation" : "Initial investigation"} · ${labelResearchStatus(row.status)}${row.stage ? ` · ${row.stage}` : ""}`,
      href: `/admin/investigations/${row.id}`,
      googleMapsUrl: row.googleMapsUrl,
    }));
  } else if (section === "proposals") {
    const branchRows = await hydrateAdminBranchRows(
      await db
        .select({
          id: proposedUpdates.id,
          branchId: branches.id,
          detailsSource: branches.detailsSource,
          address: branches.address,
          city: branches.city,
          status: proposedUpdates.status,
          business: businesses.name,
          branch: branches.name,
        })
        .from(proposedUpdates)
        .innerJoin(branches, eq(proposedUpdates.branchId, branches.id))
        .innerJoin(businesses, eq(branches.businessId, businesses.id))
        .orderBy(desc(proposedUpdates.updatedAt))
    );
    rows = branchRows.map((row) => ({
      id: row.id,
      label: row.branch ? `${row.business} · ${row.branch}` : row.business,
      detail: `Proposal status · ${labelProposalStatus(row.status)}`,
      href: `/admin/proposals/${row.id}`,
      googleMapsUrl: row.googleMapsUrl,
    }));
  } else if (section === "certificates") {
    const branchRows = await hydrateAdminBranchRows(
      await db
        .select({
          id: certificates.id,
          branchId: branches.id,
          detailsSource: branches.detailsSource,
          address: branches.address,
          city: branches.city,
          number: certificates.certificateNumber,
          products: certificates.products,
          status: certificates.reviewStatus,
          validFrom: certificates.validFrom,
          validUntil: certificates.validUntil,
          coversBranch: certificates.coversBranch,
          certifier: certifiers.name,
          branch: branches.name,
          business: businesses.name,
        })
        .from(certificates)
        .innerJoin(certifiers, eq(certificates.certifierId, certifiers.id))
        .leftJoin(branches, eq(certificates.branchId, branches.id))
        .leftJoin(businesses, eq(certificates.businessId, businesses.id))
        .orderBy(desc(certificates.updatedAt))
    );
    rows = branchRows.map((row) => ({
      id: row.id,
      label: `${row.business ?? row.branch ?? "Business-level"} · ${row.certifier} · ${row.number ?? "Certificate number unknown"}`,
      detail: `${humanizeLabel(row.status)} · ${row.products.map(humanizeLabel).join(", ")} · valid ${formatAdminDate(row.validFrom)}–${formatAdminDate(row.validUntil)}${row.validUntil && row.validUntil < new Date().toISOString().slice(0, 10) ? " · Expired" : ""}`,
      action: "certificate",
      googleMapsUrl: row.googleMapsUrl,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      coversBranch: row.coversBranch,
      certificateStatus: row.status,
    }));
  } else if (section === "corrections") {
    rows = (
      await db.select().from(corrections).orderBy(desc(corrections.createdAt))
    ).map((row) => ({
      id: row.id,
      label: `${humanizeLabel(row.status)} · ${row.isOwnerSubmission ? "Owner/manager" : "Community"} submission`,
      detail: row.body,
      href: `/admin/corrections/${row.id}`,
      action: "correction",
    }));
  } else if (section === "audit") {
    const predicates = [];
    if (filters.entityType)
      predicates.push(eq(auditEvents.entityType, filters.entityType));
    if (filters.action) predicates.push(eq(auditEvents.action, filters.action));
    const [events, entityTypes, actions] = await Promise.all([
      db
        .select({
          id: auditEvents.id,
          action: auditEvents.action,
          entityType: auditEvents.entityType,
          entityId: auditEvents.entityId,
          metadata: auditEvents.metadata,
          createdAt: auditEvents.createdAt,
          actorName: users.displayName,
          actorEmail: users.email,
        })
        .from(auditEvents)
        .leftJoin(users, eq(auditEvents.actorUserId, users.id))
        .where(predicates.length ? and(...predicates) : undefined)
        .orderBy(desc(auditEvents.createdAt))
        .limit(51)
        .offset((auditPage - 1) * 50),
      db
        .selectDistinct({ value: auditEvents.entityType })
        .from(auditEvents)
        .orderBy(asc(auditEvents.entityType)),
      db
        .selectDistinct({ value: auditEvents.action })
        .from(auditEvents)
        .orderBy(asc(auditEvents.action)),
    ]);
    auditHasNextPage = events.length > 50;
    auditRows = events.slice(0, 50).map((row) => ({
      ...row,
      metadata: row.metadata ?? {},
    }));
    entityTypeOptions = entityTypes.map((row) => row.value);
    actionOptions = actions.map((row) => row.value);
  } else if (section === "outreach") {
    [settings] = await db.select().from(outreachSettings).limit(1);
    const drafts = await db
      .select({
        id: outreachMessages.id,
        branchId: branches.id,
        detailsSource: branches.detailsSource,
        address: branches.address,
        city: branches.city,
        kind: outreachMessages.kind,
        subject: outreachMessages.subject,
        bodyText: outreachMessages.bodyText,
        business: businesses.name,
        branch: branches.name,
      })
      .from(outreachMessages)
      .innerJoin(
        outreachThreads,
        eq(outreachMessages.threadId, outreachThreads.id),
      )
      .innerJoin(branches, eq(outreachThreads.branchId, branches.id))
      .innerJoin(businesses, eq(branches.businessId, businesses.id))
      .where(eq(outreachMessages.status, "draft"))
      .orderBy(desc(outreachMessages.createdAt));
    suppressionRows = await db
      .select()
      .from(suppressions)
      .orderBy(desc(suppressions.createdAt));
    unexpectedRows = await db
      .select()
      .from(unexpectedReplies)
      .where(
        notInArray(unexpectedReplies.reviewStatus, ["dismissed", "assigned"]),
      )
      .orderBy(desc(unexpectedReplies.receivedAt));
    const threadRowsSource = await db
      .select({
        id: outreachThreads.id,
        branchId: branches.id,
        detailsSource: branches.detailsSource,
        address: branches.address,
        city: branches.city,
        business: businesses.name,
        branch: branches.name,
      })
      .from(outreachThreads)
      .innerJoin(branches, eq(outreachThreads.branchId, branches.id))
      .innerJoin(businesses, eq(branches.businessId, businesses.id))
      .orderBy(desc(outreachThreads.createdAt));
    const references = await loadAdminPlaceReferences(
      [...drafts, ...threadRowsSource].flatMap((row) =>
        row.detailsSource === "provider" && row.branchId
          ? [row.branchId]
          : [],
      ),
    );
    const hydratedDrafts = await hydrateAdminBranchRows(
      drafts,
      db,
      references,
    );
    rows = hydratedDrafts.map((row) => ({
      id: row.id,
      label: row.branch
        ? `${row.business} · ${row.branch} · ${labelMessageKind(row.kind)} draft`
        : `${row.business} · ${labelMessageKind(row.kind)} draft`,
      detail: `${row.subject}\n${row.bodyText}`,
      action: "draft",
      googleMapsUrl: row.googleMapsUrl,
    }));
    const threadRows = await hydrateAdminBranchRows(
      threadRowsSource,
      db,
      references,
    );
    threadOptions = threadRows.map((thread) => ({
      id: thread.id,
      label: thread.branch
        ? `${thread.business} · ${thread.branch}`
        : thread.business,
    }));
  } else if (section === "refresh") {
    const now = new Date();
    const refreshAfterDays = Number(process.env.REFRESH_AFTER_DAYS ?? 180);
    const warningDays = Number(process.env.CERT_EXPIRY_WARNING_DAYS ?? 30);
    const minIntervalDays = Number(process.env.REFRESH_MIN_INTERVAL_DAYS ?? 7);
    const staleDate = new Date(now.getTime() - refreshAfterDays * 86_400_000);
    const minIntervalDate = new Date(
      now.getTime() - minIntervalDays * 86_400_000,
    );
    const warningDate = new Date(now.getTime() + warningDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const candidateBranches = await hydrateAdminBranchRows(
      await db.select({
        id: branches.id,
        branchId: branches.id,
        detailsSource: branches.detailsSource,
        address: branches.address,
        city: branches.city,
        business: businesses.name,
        branch: branches.name,
        status: branches.researchStatus,
        lastConfirmedAt: branches.lastConfirmedAt,
      })
      .from(branches)
      .innerJoin(businesses, eq(branches.businessId, businesses.id)),
    );
    const staleIds = candidateBranches
      .filter(
        (branch) =>
          ["findings_published", "needs_refresh"].includes(branch.status) &&
          (!branch.lastConfirmedAt || branch.lastConfirmedAt < staleDate),
      )
      .map((branch) => branch.id);
    const expiring = await db
      .select({ branchId: certificates.branchId })
      .from(certificates)
      .where(
        and(
          eq(certificates.reviewStatus, "accepted"),
          lte(certificates.validUntil, warningDate),
        ),
      );
    const acceptedCorrections = await db
      .select({ branchId: corrections.branchId })
      .from(corrections)
      .where(eq(corrections.status, "accepted"));
    const candidateIds = [
      ...new Set([
        ...staleIds,
        ...expiring.flatMap((row) => (row.branchId ? [row.branchId] : [])),
        ...acceptedCorrections.map((row) => row.branchId),
      ]),
    ];
    const recent = await db
      .select({ branchId: investigations.branchId })
      .from(investigations)
      .where(
        and(
          eq(investigations.isActive, false),
          gte(investigations.updatedAt, minIntervalDate),
        ),
      );
    const recentlyScanned = new Set(recent.map((item) => item.branchId));
    rows = candidateBranches
      .filter(
        (branch) =>
          candidateIds.includes(branch.id) && !recentlyScanned.has(branch.id),
      )
      .map((row) => ({
        id: row.id,
        label: row.branch ? `${row.business} · ${row.branch}` : row.business,
        detail: `${labelResearchStatus(row.status)} · Last confirmed ${formatAdminDate(row.lastConfirmedAt)}`,
        href: `/places/${row.id}`,
        googleMapsUrl: row.googleMapsUrl,
      }));
  }

  const title = humanizeLabel(section);
  return (
    <section className="grid gap-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
          Operations
        </p>
        <h2 className="mt-1 font-display text-3xl font-semibold capitalize">
          {title}
        </h2>
      </header>
      {section === "investigations" ? (
        <form
          action="/admin/investigations"
          className={`${panel} flex flex-wrap items-end gap-3`}
          method="get"
        >
          <label className="grid gap-1 text-sm font-semibold">
            Status
            <select
              className="min-h-10 rounded-lg border border-border px-2 font-normal"
              defaultValue={filters.status ?? ""}
              name="status"
            >
              <option value="">All statuses</option>
              <option value="queued">Queued</option>
              <option value="checking_public_sources">
                Checking public sources
              </option>
              <option value="awaiting_outreach_approval">
                Awaiting outreach approval
              </option>
              <option value="awaiting_business_response">
                Awaiting business reply
              </option>
              <option value="reviewing_evidence">Reviewing evidence</option>
              <option value="findings_published">Findings published</option>
              <option value="unable_to_confirm">Unable to confirm</option>
              <option value="needs_refresh">Needs refresh</option>
            </select>
          </label>
          <button className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white">
            Apply filter
          </button>
          <Link
            className="text-sm font-semibold text-accent underline"
            href="/admin/investigations"
          >
            Clear
          </Link>
        </form>
      ) : null}
      {section === "audit" ? (
        <form
          action="/admin/audit"
          className={`${panel} grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]`}
          method="get"
        >
          <label className="grid gap-1 text-sm font-semibold">
            Entity type
            <select
              className="min-h-10 min-w-0 rounded-lg border border-border px-2 font-normal"
              defaultValue={filters.entityType ?? ""}
              name="entityType"
            >
              <option value="">All entity types</option>
              {entityTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {labelEntityType(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Action
            <select
              className="min-h-10 min-w-0 rounded-lg border border-border px-2 font-normal"
              defaultValue={filters.action ?? ""}
              name="action"
            >
              <option value="">All actions</option>
              {actionOptions.map((value) => (
                <option key={value} value={value}>
                  {labelAuditAction(value)}
                </option>
              ))}
            </select>
          </label>
          <button className="min-h-10 self-end rounded-lg bg-accent px-4 text-sm font-semibold text-white">
            Filter
          </button>
          <Link
            className="self-end text-sm font-semibold text-accent underline"
            href="/admin/audit"
          >
            Clear
          </Link>
        </form>
      ) : null}
      {section === "outreach" ? (
        <section className={panel}>
          <h3 className="font-semibold">Outreach settings</h3>
          <form
            action={updateOutreachSettingsAction}
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <label className="grid gap-1 text-sm">
              <span>
                Mode
                {process.env.OUTREACH_MODE === "manual_approval" ||
                process.env.OUTREACH_MODE === "auto_send_approved" ? (
                  <span className="ml-1 text-xs font-normal text-muted">
                    (set by OUTREACH_MODE)
                  </span>
                ) : null}
              </span>
              <select
                className="min-h-10 rounded-lg border border-border px-2"
                defaultValue={settings?.mode ?? "manual_approval"}
                name="mode"
              >
                <option value="manual_approval">Manual approval</option>
                <option value="auto_send_approved">Auto-send approved</option>
              </select>
            </label>
            <NumberField
              label="Maximum follow-ups"
              name="maxFollowups"
              value={settings?.maxFollowups ?? 2}
            />
            <NumberField
              label="Minimum days between messages"
              name="minDaysBetweenMessages"
              value={settings?.minDaysBetweenMessages ?? 3}
            />
            <NumberField
              label="Per-business limit (30 days)"
              name="maxMessagesPerBusiness30d"
              value={settings?.maxMessagesPerBusiness30d ?? 4}
            />
            <NumberField
              label="No-response days"
              name="noResponseDays"
              value={settings?.noResponseDays ?? 7}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                defaultChecked={settings?.paused ?? false}
                name="paused"
                type="checkbox"
              />{" "}
              Pause outreach
            </label>
            <button className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-white sm:col-span-2">
              Save settings
            </button>
          </form>
        </section>
      ) : null}
      {section === "audit" ? (
        <section aria-label="Audit events" className="grid min-w-0 gap-3">
          {auditRows.length ? (
            auditRows.map((row) => {
              const metadataEntries = Object.entries(row.metadata)
                .filter(
                  ([key, value]) =>
                    !privateMetadataKey.test(key) &&
                    !(
                      typeof value === "string" &&
                      privateMetadataValue.test(value)
                    ),
                )
                .slice(0, 8);
              const entityHref =
                row.entityType === "investigation"
                  ? `/admin/investigations/${row.entityId}`
                  : row.entityType === "proposed_update"
                    ? `/admin/proposals/${row.entityId}`
                    : row.entityType === "correction"
                      ? `/admin/corrections/${row.entityId}`
                      : row.entityType === "branch"
                        ? `/places/${row.entityId}`
                        : row.entityType === "published_revision" &&
                            typeof row.metadata.branchId === "string"
                          ? `/places/${row.metadata.branchId}`
                          : null;
              const entityLabel = `${labelEntityType(row.entityType)} · ${row.entityId.slice(0, 8)}`;
              return (
                <article className={`${panel} min-w-0`} key={row.id}>
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 break-words">
                      <p className="font-semibold">
                        {labelAuditAction(row.action)}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {row.actorName
                          ? row.actorEmail
                            ? `${row.actorName} (${row.actorEmail})`
                            : row.actorName
                          : (row.actorEmail ?? "System")}
                      </p>
                    </div>
                    <time
                      className="text-xs text-muted"
                      dateTime={row.createdAt.toISOString()}
                    >
                      {formatAdminDateTime(row.createdAt)}
                    </time>
                  </div>
                  <p className="mt-2 break-all text-sm">
                    {entityHref ? (
                      <Link
                        className="font-semibold text-accent underline"
                        href={entityHref}
                      >
                        {entityLabel}
                      </Link>
                    ) : (
                      entityLabel
                    )}
                  </p>
                  {metadataEntries.length ? (
                    <dl className="mt-3 grid gap-x-3 gap-y-1 border-t border-border pt-2 text-xs sm:grid-cols-[max-content_minmax(0,1fr)]">
                      {metadataEntries.map(([key, value]) => (
                        <div
                          className="grid min-w-0 grid-cols-subgrid"
                          key={key}
                        >
                          <dt className="font-semibold text-muted">
                            {humanizeLabel(key)}
                          </dt>
                          <dd className="min-w-0 break-all">
                            {key.toLocaleLowerCase().includes("jobname")
                              ? labelJobName(String(value))
                              : typeof value === "boolean"
                                ? value
                                  ? "Yes"
                                  : "No"
                                : value === null
                                  ? "—"
                                  : String(value).slice(0, 160)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </article>
              );
            })
          ) : (
            <p className={`${panel} text-sm text-muted`}>
              No audit events match these filters.
            </p>
          )}
        </section>
      ) : rows.length ? (
        <div className="grid gap-3">
          {rows.map((row) => (
            <article className={`${panel} grid min-w-0 gap-3`} key={row.id}>
              <div className="min-w-0">
                {row.href ? (
                  <Link
                    className="font-semibold text-accent underline"
                    href={row.href}
                  >
                    {row.label}
                  </Link>
                ) : (
                  <h3 className="font-semibold">{row.label}</h3>
                )}
                {row.googleMapsUrl ? (
                  <a
                    className="mt-1 block text-sm font-semibold text-accent underline"
                    href={row.googleMapsUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    View on Google Maps
                  </a>
                ) : null}
                {row.detail ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">
                    {row.detail}
                  </p>
                ) : null}
              </div>
              {row.action === "draft" ? (
                <div className="flex flex-wrap gap-2">
                  <form
                    action={approveDraftAdminAction}
                    className="flex items-center gap-2"
                  >
                    <input name="messageId" type="hidden" value={row.id} />
                    <label className="text-sm">
                      <input
                        className="mr-1"
                        name="approveContact"
                        type="checkbox"
                      />
                      Also approve contact
                    </label>
                    <button className="min-h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-white">
                      Approve draft
                    </button>
                  </form>
                  <form action={rejectDraftAdminAction}>
                    <input name="messageId" type="hidden" value={row.id} />
                    <button className="min-h-9 rounded-lg border border-border px-3 text-sm font-semibold">
                      Reject
                    </button>
                  </form>
                </div>
              ) : row.action === "certificate" ? (
                <form
                  action={reviewCertificateAdminAction}
                  className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2"
                >
                  <input name="certificateId" type="hidden" value={row.id} />
                  <label className="grid gap-1 text-xs font-semibold">
                    Review status
                    <select
                      className="min-h-9 rounded-lg border border-border px-2 font-normal"
                      defaultValue={row.certificateStatus}
                      name="status"
                    >
                      <option value="pending" disabled>
                        Pending review
                      </option>
                      <option value="accepted">Accept</option>
                      <option value="rejected">Reject</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">
                    Valid from
                    <input
                      className="min-h-9 rounded-lg border border-border px-2 font-normal"
                      defaultValue={row.validFrom ?? ""}
                      name="validFrom"
                      type="date"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">
                    Valid until
                    <input
                      className="min-h-9 rounded-lg border border-border px-2 font-normal"
                      defaultValue={row.validUntil ?? ""}
                      name="validUntil"
                      type="date"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">
                    Branch coverage
                    <select
                      className="min-h-9 rounded-lg border border-border px-2 font-normal"
                      defaultValue={
                        row.coversBranch === null
                          ? ""
                          : String(row.coversBranch)
                      }
                      name="coversBranch"
                    >
                      <option value="">Unknown</option>
                      <option value="true">Covers this branch</option>
                      <option value="false">Does not cover this branch</option>
                    </select>
                  </label>
                  <button className="min-h-9 rounded-lg bg-accent px-3 text-xs font-semibold text-white sm:col-span-2">
                    Save certificate review
                  </button>
                </form>
              ) : row.action === "correction" ? (
                <Link
                  className="text-sm font-semibold text-accent underline"
                  href={row.href ?? "#"}
                >
                  Review correction
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className={`${panel} text-sm text-muted`}>No items to review.</p>
      )}
      {section === "audit" ? (
        <nav
          aria-label="Audit pagination"
          className="flex min-w-0 flex-wrap justify-between gap-3"
        >
          {auditPage > 1 ? (
            <Link
              className="text-sm font-semibold text-accent"
              href={`/admin/audit?page=${auditPage - 1}&entityType=${encodeURIComponent(filters.entityType ?? "")}&action=${encodeURIComponent(filters.action ?? "")}`}
            >
              Previous page
            </Link>
          ) : (
            <span className="text-sm text-muted">Previous page</span>
          )}
          <span className="text-sm text-muted">Page {auditPage}</span>
          {auditHasNextPage ? (
            <Link
              className="text-sm font-semibold text-accent"
              href={`/admin/audit?page=${auditPage + 1}&entityType=${encodeURIComponent(filters.entityType ?? "")}&action=${encodeURIComponent(filters.action ?? "")}`}
            >
              Next page
            </Link>
          ) : (
            <span className="text-sm text-muted">Next page</span>
          )}
        </nav>
      ) : null}
      {section === "outreach" ? (
        <>
          <section className={`${panel} grid gap-3`}>
            <h3 className="font-semibold">Emergency pause</h3>
            <p className="text-sm text-muted">
              {settings?.paused
                ? "Outreach is currently paused."
                : "Outreach is enabled."}
            </p>
            <form
              action={emergencyPauseAction}
              className="flex flex-wrap items-center gap-3"
            >
              <input
                name="paused"
                type="hidden"
                value={String(!settings?.paused)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input name="confirm" required type="checkbox" /> Confirm change
              </label>
              <button className="min-h-10 rounded-lg bg-danger px-4 text-sm font-semibold text-white">
                {settings?.paused ? "Resume outreach" : "Emergency pause"}
              </button>
            </form>
          </section>
          <section className={`${panel} grid gap-3`}>
            <h3 className="font-semibold">Suppression list</h3>
            <form
              action={addSuppressionAdminAction}
              className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]"
            >
              <input
                aria-label="Suppressed email or domain"
                className="min-h-10 rounded-lg border border-border px-2 text-sm"
                name="value"
                placeholder="address@example.com or example.com"
                required
              />
              <select
                aria-label="Suppression type"
                className="min-h-10 rounded-lg border border-border px-2 text-sm"
                name="kind"
              >
                <option value="email">Email</option>
                <option value="domain">Domain</option>
              </select>
              <input
                aria-label="Suppression note"
                className="min-h-10 rounded-lg border border-border px-2 text-sm"
                name="note"
                placeholder="Reason or note"
              />
              <button className="min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-white">
                Add
              </button>
            </form>
            {suppressionRows.map((row) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm"
                key={row.id}
              >
                <span className="min-w-0 break-words">
                  <span className="break-all">{row.valueNormalized}</span> ·{" "}
                  {humanizeLabel(row.kind)} · {humanizeLabel(row.reason)}
                  {row.note ? ` · ${row.note}` : ""}
                </span>
                <form action={removeSuppressionAdminAction}>
                  <input name="suppressionId" type="hidden" value={row.id} />
                  <button className="text-xs font-semibold text-danger underline">
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </section>
          <section className={`${panel} grid gap-3`}>
            <h3 className="font-semibold">Unexpected replies</h3>
            {unexpectedRows.length ? (
              unexpectedRows.map((reply) => (
                <article
                  className="grid gap-2 border-t border-border pt-3"
                  key={reply.id}
                >
                  <p className="break-words text-sm font-semibold">
                    <span className="break-all">{reply.fromAddress}</span> ·{" "}
                    {reply.subject}
                  </p>
                  <p className="break-words whitespace-pre-wrap text-sm text-muted">
                    {reply.bodyText}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <form
                      action={assignUnexpectedReplyAdminAction}
                      className="flex flex-wrap gap-2"
                    >
                      <input name="replyId" type="hidden" value={reply.id} />
                      <select
                        aria-label="Assign reply to thread"
                        className="min-h-9 rounded-lg border border-border px-2 text-xs"
                        name="threadId"
                        required
                      >
                        <option value="">Choose investigation thread</option>
                        {threadOptions.map((thread) => (
                          <option key={thread.id} value={thread.id}>
                            {thread.label}
                          </option>
                        ))}
                      </select>
                      <button className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold">
                        Assign to thread
                      </button>
                    </form>
                    <form action={dismissUnexpectedReplyAdminAction}>
                      <input name="replyId" type="hidden" value={reply.id} />
                      <button className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold">
                        Dismiss
                      </button>
                    </form>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted">No unexpected replies.</p>
            )}
          </section>
          <OutboxViewer />
        </>
      ) : null}
      {section === "refresh" ? (
        <form action={runRefreshScanAction}>
          <button className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-white">
            Run scan now
          </button>
        </form>
      ) : null}
    </section>
  );
}

function NumberField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: number;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        className="min-h-10 rounded-lg border border-border px-2"
        defaultValue={value}
        max={30}
        min={0}
        name={name}
        type="number"
      />
    </label>
  );
}

async function OutboxViewer() {
  const messages = await db
    .select()
    .from(emailOutbox)
    .orderBy(desc(emailOutbox.createdAt))
    .limit(30);
  return (
    <section className={`${panel} grid gap-3`}>
      <h3 className="font-semibold">Captured — not sent</h3>
      {messages.length ? (
        messages.map((message) => (
          <details className="border-t border-border pt-3" key={message.id}>
            <summary className="cursor-pointer text-sm font-semibold">
              {message.to} · {message.subject}
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {message.bodyText}
            </p>
          </details>
        ))
      ) : (
        <p className="text-sm text-muted">No captured outbound messages.</p>
      )}
    </section>
  );
}
