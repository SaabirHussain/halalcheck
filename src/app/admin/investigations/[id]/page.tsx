import { db } from "@/db";
import {
  branches,
  businesses,
  contactEndpoints,
  investigations,
  jobRuns,
  outreachMessages,
  outreachThreads,
  proposedUpdates,
  sources,
} from "@/db/schema";
import { asc, desc, eq, inArray } from "drizzle-orm";
import {
  addContactAdminAction,
  approveDraftAdminAction,
  cancelInvestigationAction,
  confirmProviderBusinessDetailsAction,
  editDraftAdminAction,
  addSuppressionAdminAction,
  pauseInvestigationAction,
  rejectDraftAdminAction,
  reviewContactAdminAction,
  resumeInvestigationAction,
  updateSourceAdminAction,
} from "@/app/admin/actions";
import { retryJobAction } from "@/app/admin/actions";
import { ReplySimulator } from "@/components/admin/ReplySimulator";
import { researchQuestions } from "@/lib/domain/outreach";
import { hydrateAdminBranchRows } from "@/lib/domain/admin-place-references";
import { GoogleAttribution } from "@/components/ui/GoogleAttribution";
import {
  formatAdminDateTime,
  humanizeLabel,
  labelJobName,
  labelMessageKind,
  labelMessageStatus,
  labelProposalStatus,
  labelResearchStatus,
  labelSourceKind,
} from "@/lib/labels";

export default async function InvestigationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ simulated?: string; inline?: string }>;
}) {
  const { id } = await params;
  const { simulated, inline } = await searchParams;
  const [row] = await db
    .select()
    .from(investigations)
    .where(eq(investigations.id, id))
    .limit(1);
  if (!row) return <p className="text-muted">Investigation not found.</p>;
  const [branchRow] = await db
    .select({
      id: branches.id,
      detailsSource: branches.detailsSource,
      name: businesses.name,
      branchName: branches.name,
      address: branches.address,
      city: branches.city,
    })
    .from(branches)
    .innerJoin(businesses, eq(branches.businessId, businesses.id))
    .where(eq(branches.id, row.branchId))
    .limit(1);
  const [branch] = branchRow
    ? await hydrateAdminBranchRows([
        {
          ...branchRow,
          branchId: branchRow.id,
          business: branchRow.name,
          branch: branchRow.branchName,
        },
      ])
    : [undefined];
  const sourceRows = await db
    .select()
    .from(sources)
    .where(eq(sources.investigationId, id))
    .orderBy(desc(sources.retrievedAt));
  const jobRows = await db
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.investigationId, id))
    .orderBy(desc(jobRuns.createdAt));
  const proposalRows = await db
    .select()
    .from(proposedUpdates)
    .where(eq(proposedUpdates.investigationId, id))
    .orderBy(desc(proposedUpdates.createdAt));
  const threads = await db
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.investigationId, id));
  const endpointRows = threads.flatMap((thread) =>
    thread.contactEndpointId ? [thread.contactEndpointId] : [],
  );
  const endpoints = endpointRows.length
    ? await db
        .select()
        .from(contactEndpoints)
        .where(inArray(contactEndpoints.id, endpointRows))
    : [];
  const messages = await db
    .select({
      id: outreachMessages.id,
      direction: outreachMessages.direction,
      sequence: outreachMessages.sequence,
      kind: outreachMessages.kind,
      status: outreachMessages.status,
      subject: outreachMessages.subject,
      bodyText: outreachMessages.bodyText,
      questions: outreachMessages.questions,
      providerMessageId: outreachMessages.providerMessageId,
      scheduledFor: outreachMessages.scheduledFor,
      sentAt: outreachMessages.sentAt,
      receivedAt: outreachMessages.receivedAt,
      createdAt: outreachMessages.createdAt,
    })
    .from(outreachMessages)
    .innerJoin(
      outreachThreads,
      eq(outreachMessages.threadId, outreachThreads.id),
    )
    .where(eq(outreachThreads.investigationId, id))
    .orderBy(asc(outreachMessages.sequence), asc(outreachMessages.createdAt));
  const simulatedMessage = simulated
    ? messages.find(
        (message) =>
          message.direction === "inbound" &&
          message.providerMessageId === simulated,
      )
    : undefined;
  const simulatedParse = simulatedMessage
    ? jobRows.find(
        (job) => job.idempotencyKey === `message_parse:${simulatedMessage.id}`,
      )
    : undefined;
  const simulatedResult =
    simulatedParse?.status === "succeeded" ||
    (simulatedMessage && inline === "true")
      ? proposalRows.length
        ? `Reply parsed${inline === "true" ? " inline" : ""}. A proposal is ready for review.`
        : messages.some(
              (message) =>
                message.direction === "outbound" &&
                message.status === "draft" &&
                message.sequence > simulatedMessage!.sequence,
            )
          ? `Reply parsed${inline === "true" ? " inline" : ""}. A follow-up draft is ready for review.`
          : `Reply parsed${inline === "true" ? " inline" : ""}. Evidence review is in progress.`
      : simulatedParse?.status === "failed"
        ? "Reply parsing failed. Review the job run details below."
        : simulatedMessage
          ? "Reply received. The parser is processing the queued job."
          : "The simulated reply did not match an outreach thread.";
  const terminal = [
    "findings_published",
    "unable_to_confirm",
    "needs_refresh",
    "cancelled",
  ].includes(row.status);
  const canPause = row.isActive && !row.paused && !terminal;
  const canResume = row.isActive && row.paused;
  const canCancel = row.isActive && !terminal;
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <header className="min-w-0 rounded-card border border-border bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
          {row.kind === "refresh"
            ? "Refresh investigation"
            : "Initial investigation"}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {branch?.business}
          {branch?.branch ? ` · ${branch.branch}` : ""}
        </h2>
        <p className="mt-2 text-sm font-semibold capitalize">
          {labelResearchStatus(row.status)}
        </p>
        <p className="mt-1 text-sm text-muted">
          {row.stageDetail ?? "No stage detail recorded."}
        </p>
        <div className="mt-4 flex min-w-0 flex-wrap gap-2">
          {canPause ? (
            <form action={pauseInvestigationAction}>
              <input name="investigationId" type="hidden" value={id} />
              <label className="mr-2 text-xs">
                <input required type="checkbox" /> Confirm pause
              </label>
              <button className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold">
                Pause
              </button>
            </form>
          ) : null}
          {canResume ? (
            <form action={resumeInvestigationAction}>
              <input name="investigationId" type="hidden" value={id} />
              <label className="mr-2 text-xs">
                <input required type="checkbox" /> Confirm resume
              </label>
              <button className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold">
                Resume
              </button>
            </form>
          ) : null}
          {canCancel ? (
            <form action={cancelInvestigationAction}>
              <input name="investigationId" type="hidden" value={id} />
              <label className="mr-2 text-xs">
                <input required type="checkbox" /> Confirm cancel
              </label>
              <button className="min-h-10 rounded-lg border border-danger/30 px-3 text-sm font-semibold text-danger">
                Cancel
              </button>
            </form>
          ) : null}
        </div>
      </header>
      {branch?.detailsSource === "provider" ? (
        <section className="grid gap-4 rounded-card border border-border bg-surface p-5">
          <div>
            <h3 className="font-display text-xl font-semibold">
              Confirm business details
            </h3>
            <p className="mt-1 text-sm text-muted">
              Confirm details from the business’s own website or signage before
              contacting the business.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <p className="text-sm font-semibold">
              From Google Maps — reference only, not saved
            </p>
            <GoogleAttribution />
            {branch.googleMapsUrl ? (
              <a
                className="mt-2 inline-block text-sm font-semibold text-accent underline"
                href={branch.googleMapsUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                View on Google Maps
              </a>
            ) : null}
          </div>
          <form
            action={confirmProviderBusinessDetailsAction}
            className="grid gap-3 sm:grid-cols-2"
          >
            <input name="branchId" type="hidden" value={branch.id} />
            <input name="investigationId" type="hidden" value={id} />
            <label className="grid gap-1 text-sm font-semibold">
              Name
              <input
                className="min-h-11 rounded-lg border border-border bg-background px-3 font-normal"
                maxLength={200}
                name="name"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Address
              <input
                className="min-h-11 rounded-lg border border-border bg-background px-3 font-normal"
                maxLength={500}
                name="address"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              City
              <input
                className="min-h-11 rounded-lg border border-border bg-background px-3 font-normal"
                maxLength={200}
                name="city"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Website
              <input
                className="min-h-11 rounded-lg border border-border bg-background px-3 font-normal"
                name="website"
                type="url"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Phone
              <input
                className="min-h-11 rounded-lg border border-border bg-background px-3 font-normal"
                name="phone"
                type="tel"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Timezone
              <input
                className="min-h-11 rounded-lg border border-border bg-background px-3 font-normal"
                defaultValue="America/Toronto"
                name="timezone"
                required
              />
            </label>
            <button className="min-h-11 rounded-lg bg-accent px-4 font-semibold text-white sm:col-span-2">
              Save confirmed business details
            </button>
          </form>
        </section>
      ) : null}
      {process.env.DEMO_MODE === "true" && simulated ? (
        <p
          className="rounded-xl border border-info/20 bg-info-soft p-3 text-sm"
          role="status"
        >
          {simulatedResult}
        </p>
      ) : null}
      <section className="min-w-0 rounded-card border border-border bg-surface p-4">
        <h3 className="font-semibold">Job runs</h3>
        {jobRows.length ? (
          jobRows.map((job) => (
            <div
              className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm"
              key={job.id}
            >
              <div className="min-w-0 break-words">
                <strong>{labelJobName(job.jobName)}</strong> ·{" "}
                {humanizeLabel(job.status)} · {job.attempts} attempts
                <p className="break-words text-muted">
                  {job.lastError ?? "No error"} · Updated{" "}
                  {formatAdminDateTime(job.updatedAt)}
                </p>
              </div>
              {job.status === "failed" ? (
                <form action={retryJobAction}>
                  <input name="jobRunId" type="hidden" value={job.id} />
                  <button className="min-h-9 rounded-lg border border-border px-3">
                    Retry
                  </button>
                </form>
              ) : null}
            </div>
          ))
        ) : (
          <p className="mt-2 text-sm text-muted">No job runs.</p>
        )}
      </section>
      <section className="min-w-0 rounded-card border border-border bg-surface p-4">
        <h3 className="font-semibold">Sources</h3>
        {sourceRows.map((source) => (
          <details className="mt-3 border-t border-border pt-3" key={source.id}>
            <summary className="min-w-0 cursor-pointer break-words text-sm font-semibold">
              {labelSourceKind(source.kind)} ·{" "}
              {source.url ? (
                <span className="break-all">{source.url}</span>
              ) : (
                "Private source"
              )}{" "}
              · {formatAdminDateTime(source.retrievedAt)}
            </summary>
            <p className="mt-2 break-words text-sm">
              {source.publicExcerpt ?? "No public excerpt."}
            </p>
            <pre className="mt-2 max-h-48 overflow-auto break-all whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-xs">
              {source.rawText ?? "Raw source text unavailable."}
            </pre>
            <form action={updateSourceAdminAction} className="mt-3 grid gap-2">
              <input name="sourceId" type="hidden" value={source.id} />
              <label className="grid gap-1 text-xs font-semibold">
                Public excerpt
                <textarea
                  className="min-h-20 rounded-lg border border-border p-2"
                  defaultValue={source.publicExcerpt ?? ""}
                  name="publicExcerpt"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  defaultChecked={source.isPublic}
                  name="isPublic"
                  type="checkbox"
                />
                Make excerpt public
              </label>
              <button className="min-h-9 w-fit rounded-lg border border-border px-3 text-xs font-semibold">
                Save source review
              </button>
            </form>
          </details>
        ))}
      </section>
      <section className="min-w-0 rounded-card border border-border bg-surface p-4">
        <h3 className="font-semibold">Contact endpoints</h3>
        {endpoints.map((endpoint) => (
          <div
            className="mt-3 min-w-0 border-t border-border pt-3"
            key={endpoint.id}
          >
            <p className="break-words text-sm">
              <span className="break-all">{endpoint.value}</span> ·{" "}
              {humanizeLabel(endpoint.status)}
              {endpoint.isPersonal ? " · personal" : ""}
              {endpoint.notes ? ` · ${endpoint.notes}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["approved", "rejected", "ambiguous"] as const).map(
                (status) => (
                  <form action={reviewContactAdminAction} key={status}>
                    <input
                      name="endpointId"
                      type="hidden"
                      value={endpoint.id}
                    />
                    <input name="status" type="hidden" value={status} />
                    <button className="min-h-8 rounded-lg border border-border px-2 text-xs font-semibold capitalize">
                      {status}
                    </button>
                  </form>
                ),
              )}
              {endpoint.kind === "email" ? (
                <form action={addSuppressionAdminAction}>
                  <input name="value" type="hidden" value={endpoint.value} />
                  <input name="kind" type="hidden" value="email" />
                  <input name="reason" type="hidden" value="manual" />
                  <input
                    name="note"
                    type="hidden"
                    value="Suppressed from investigation contact review"
                  />
                  <button className="min-h-8 rounded-lg border border-danger/30 px-2 text-xs font-semibold text-danger">
                    Suppress
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
        <form
          action={addContactAdminAction}
          className="mt-4 grid gap-2 border-t border-border pt-3 sm:grid-cols-2"
        >
          <input name="branchId" type="hidden" value={row.branchId} />
          <label className="grid gap-1 text-xs font-semibold">
            Contact value
            <input
              className="min-h-10 rounded-lg border border-border px-2 font-normal"
              name="value"
              required
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Type
            <select
              className="min-h-10 rounded-lg border border-border px-2 font-normal"
              name="kind"
            >
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="web_form">Web form</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold sm:col-span-2">
            Review notes
            <input
              className="min-h-10 rounded-lg border border-border px-2 font-normal"
              name="notes"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input name="isPersonal" type="checkbox" /> Personal or ambiguous
            contact
          </label>
          <button className="min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-white">
            Add contact endpoint
          </button>
        </form>
      </section>
      <section className="min-w-0 rounded-card border border-border bg-surface p-4">
        <h3 className="font-semibold">Outreach thread</h3>
        {messages.map((message) => (
          <article
            className={`mt-3 min-w-0 rounded-xl border p-3 text-sm ${message.direction === "inbound" ? "border-info/20 bg-info-soft" : "border-accent/20 bg-accent-soft"}`}
            key={message.id}
          >
            <p className="font-semibold">
              {labelMessageKind(message.kind)} · #{message.sequence} ·{" "}
              {labelMessageStatus(message.status)}
            </p>
            {message.subject ? (
              <p className="mt-1 break-words font-medium">{message.subject}</p>
            ) : null}
            <p className="mt-2 break-words whitespace-pre-wrap">
              {message.bodyText}
            </p>
            {message.questions.length ? (
              <p className="mt-2 text-xs text-muted">
                Questions this message asks:{" "}
                {message.questions
                  .map(
                    (key) =>
                      researchQuestions.find((question) => question.key === key)
                        ?.prompt ?? "Additional research question",
                  )
                  .join(", ")}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted">
              Scheduled: {formatAdminDateTime(message.scheduledFor)} · Sent:{" "}
              {formatAdminDateTime(message.sentAt)} · Received:{" "}
              {formatAdminDateTime(message.receivedAt)}
            </p>
            {message.direction === "outbound" && message.status === "draft" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <form
                  action={editDraftAdminAction}
                  className="grid w-full gap-2"
                >
                  <input name="messageId" type="hidden" value={message.id} />
                  {message.questions.map((question) => (
                    <input
                      key={question}
                      name="questions"
                      type="hidden"
                      value={question}
                    />
                  ))}
                  <input
                    aria-label="Edit draft subject"
                    className="min-h-10 rounded-lg border border-border px-2 text-sm"
                    defaultValue={message.subject ?? ""}
                    name="subject"
                  />
                  <textarea
                    aria-label="Edit draft body"
                    className="min-h-24 rounded-lg border border-border p-2 text-sm"
                    defaultValue={message.bodyText}
                    name="bodyText"
                  />
                  <button className="min-h-9 w-fit rounded-lg border border-border px-3 text-sm font-semibold">
                    Save draft
                  </button>
                </form>
                <form action={approveDraftAdminAction}>
                  <input name="messageId" type="hidden" value={message.id} />
                  <label className="mr-2 text-xs">
                    <input name="approveContact" type="checkbox" /> Also approve
                    contact
                  </label>
                  <button className="min-h-9 rounded-lg bg-accent px-3 font-semibold text-white">
                    Approve
                  </button>
                </form>
                <form action={rejectDraftAdminAction}>
                  <input name="messageId" type="hidden" value={message.id} />
                  <button className="min-h-9 rounded-lg border border-border px-3">
                    Reject
                  </button>
                </form>
              </div>
            ) : null}
          </article>
        ))}
      </section>
      <section className="min-w-0 rounded-card border border-border bg-surface p-4">
        <h3 className="font-semibold">Proposals and flags</h3>
        {proposalRows.map((proposal) => (
          <div
            className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm"
            key={proposal.id}
          >
            <span className="rounded-full border border-border px-2 py-1 text-xs font-semibold">
              {labelProposalStatus(proposal.status)}
            </span>
            <a
              className="font-semibold text-accent underline"
              href={`/admin/proposals/${proposal.id}`}
            >
              {proposal.status === "pending"
                ? "Review proposal"
                : "View proposal"}
            </a>
            <span className="break-words text-muted">
              {proposal.flags
                .map((flag) => humanizeLabel(flag.type))
                .join(", ")}
            </span>
          </div>
        ))}
      </section>
      {process.env.DEMO_MODE === "true" ? (
        <ReplySimulator investigationId={id} />
      ) : null}
    </section>
  );
}
