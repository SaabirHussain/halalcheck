import Link from "next/link";
import { db } from "@/db";
import {
  corrections,
  investigations,
  jobRuns,
  outreachMessages,
  outreachSettings,
  proposedUpdates,
  unexpectedReplies,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { emergencyPauseAction, retryJobAction } from "./actions";
import { labelJobName, labelResearchStatus } from "@/lib/labels";
export default async function AdminHome() {
  const [
    all,
    drafts,
    proposals,
    openCorrections,
    unexpected,
    failedJobs,
    settings,
  ] = await Promise.all([
    db.select({ status: investigations.status }).from(investigations),
    db
      .select({ id: outreachMessages.id, subject: outreachMessages.subject })
      .from(outreachMessages)
      .where(eq(outreachMessages.status, "draft"))
      .limit(8),
    db
      .select({ id: proposedUpdates.id })
      .from(proposedUpdates)
      .where(eq(proposedUpdates.status, "pending"))
      .limit(8),
    db
      .select({ id: corrections.id })
      .from(corrections)
      .where(eq(corrections.status, "open"))
      .limit(8),
    db
      .select({ id: unexpectedReplies.id })
      .from(unexpectedReplies)
      .where(eq(unexpectedReplies.reviewStatus, "pending"))
      .limit(8),
    db.select().from(jobRuns).where(eq(jobRuns.status, "failed")).limit(10),
    db.select().from(outreachSettings).limit(1),
  ]);
  const counts = new Map<string, number>();
  for (const row of all)
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const paused = settings[0]?.paused ?? false;
  return (
    <section className="grid min-w-0 gap-5">
      <header>
        <p className="text-sm text-muted">Review queues and system health</p>
        <h2 className="mt-1 font-display text-3xl font-semibold">
          Research overview
        </h2>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...counts.entries()].map(([status, count]) => (
          <article
            className="min-w-0 rounded-xl border border-border bg-surface p-4"
            key={status}
          >
            <p className="break-words text-sm text-muted">
              {labelResearchStatus(status)}
            </p>
            <p className="mt-1 text-2xl font-semibold">{count}</p>
          </article>
        ))}
      </div>
      <section
        className={`rounded-card border p-4 ${paused ? "border-danger/30 bg-danger-soft" : "border-warn/30 bg-warn-soft"}`}
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">
              {paused ? "Emergency pause is active" : "Outreach is enabled"}
            </h3>
            <p className="text-sm text-muted">
              Confirm before changing outbound processing.
            </p>
          </div>
          <form
            action={emergencyPauseAction}
            className="flex flex-wrap items-center gap-2"
          >
            <input name="paused" type="hidden" value={String(!paused)} />
            <label className="flex items-center gap-2 text-sm">
              <input name="confirm" required type="checkbox" />
              Confirm change
            </label>
            <button className="min-h-10 rounded-lg bg-ink px-3 text-sm font-semibold text-white">
              {paused ? "Resume outreach" : "Emergency pause"}
            </button>
          </form>
        </div>
      </section>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <QueueCard
          title="Pending outreach drafts"
          href="/admin/outreach"
          count={drafts.length}
        >
          {drafts.map((item) => (
            <p key={item.id}>{item.subject}</p>
          ))}
        </QueueCard>
        <QueueCard
          title="Proposals awaiting review"
          href="/admin/proposals"
          count={proposals.length}
        >
          <p>Review proposed public findings and material changes.</p>
        </QueueCard>
        <QueueCard
          title="Corrections awaiting review"
          href="/admin/corrections"
          count={openCorrections.length}
        >
          <p>Private user-provided corrections and attachments.</p>
        </QueueCard>
        <QueueCard
          title="Unexpected replies"
          href="/admin/outreach"
          count={unexpected.length}
        >
          <p>Messages that need assignment or dismissal.</p>
        </QueueCard>
      </div>
      <section className="rounded-card border border-border bg-surface p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Failed job runs</h3>
          <Link
            className="text-sm font-semibold text-accent underline"
            href="/admin/investigations"
          >
            View investigations
          </Link>
        </div>
        {failedJobs.length ? (
          failedJobs.map((job) => (
            <article
              className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm"
              key={job.id}
            >
              <div className="min-w-0 break-words">
                <p className="font-semibold">{labelJobName(job.jobName)}</p>
                <p className="break-words text-muted">
                  {job.lastError ?? "No error detail."}
                </p>
              </div>
              <form action={retryJobAction}>
                <input name="jobRunId" type="hidden" value={job.id} />
                <button className="min-h-9 rounded-lg border border-border px-3 font-semibold">
                  Retry
                </button>
              </form>
            </article>
          ))
        ) : (
          <p className="mt-3 text-sm text-muted">No failed jobs.</p>
        )}
      </section>
    </section>
  );
}

function QueueCard({
  title,
  href,
  count,
  children,
}: {
  title: string;
  href: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      className="rounded-card border border-border bg-surface p-4 hover:border-accent"
      href={href}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h3 className="min-w-0 break-words font-semibold">{title}</h3>
        <span className="rounded-full bg-accent-soft px-2 py-1 text-xs font-bold text-accent-strong">
          {count}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-sm text-muted">{children}</div>
    </Link>
  );
}
