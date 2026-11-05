import { db } from "@/db";
import { claims, proposedUpdates } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import {
  closeProposalUnableToConfirmAction,
  editProposedClaimAdminAction,
  publishProposalAdminAction,
  rejectProposalAdminAction,
} from "@/app/admin/actions";
import {
  humanizeLabel,
  labelAttribute,
  labelProduct,
  labelProposalStatus,
} from "@/lib/labels";

export default async function ProposalDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [proposal] = await db
    .select()
    .from(proposedUpdates)
    .where(eq(proposedUpdates.id, id))
    .limit(1);
  if (!proposal) return <p>Proposal not found.</p>;
  const rows = await db
    .select()
    .from(claims)
    .where(eq(claims.proposedUpdateId, id));
  const published = await db
    .select()
    .from(claims)
    .where(eq(claims.branchId, proposal.branchId));
  const materialClaimIds = new Set(
    proposal.flags
      .filter((flag) => flag.type === "material_change")
      .flatMap((flag) => flag.claimIds),
  );

  if (proposal.status === "approved") {
    return (
      <section className="grid gap-4">
        <h2 className="font-display text-2xl font-semibold">
          {labelProposalStatus(proposal.status)} proposal
        </h2>
        <p>This proposal has been published to the public branch record.</p>
        <Link
          className="font-semibold text-accent underline"
          href={`/places/${proposal.branchId}`}
        >
          View public findings
        </Link>
      </section>
    );
  }

  return (
    <section className="grid min-w-0 gap-5">
      <header className="rounded-card border border-border bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
          Evidence proposal
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Review claims before publication
        </h2>
        <p className="mt-2 text-sm text-muted">
          Proposed findings are private until an administrator publishes them.
        </p>
      </header>
      <section className="rounded-card border border-border bg-surface p-4">
        <h3 className="font-semibold">Review flags</h3>
        {proposal.flags.length ? (
          proposal.flags.map((flag, index) => (
            <article className="mt-3 border-t border-border pt-3" key={index}>
              <strong className="capitalize">{humanizeLabel(flag.type)}</strong>
              <p className="mt-1 text-sm text-muted">{flag.detail}</p>
            </article>
          ))
        ) : (
          <p className="mt-2 text-sm text-muted">No review flags.</p>
        )}
      </section>
      <section className="grid min-w-0 gap-3">
        <h3 className="font-semibold">Currently published vs proposed</h3>
        {rows.map((claim) => {
          const current = published.find(
            (item) =>
              item.status === "published" &&
              item.product === claim.product &&
              item.attribute === claim.attribute,
          );
          return (
            <article
              className="grid min-w-0 gap-3 rounded-card border border-border bg-surface p-4 lg:grid-cols-2"
              key={claim.id}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Currently published
                </p>
                <h4 className="mt-1 font-semibold">
                  {labelProduct(claim.product)} ·{" "}
                  {labelAttribute(claim.attribute)}
                </h4>
                <p className="mt-1 text-sm">
                  {current?.value ?? "No published finding"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Proposed
                </p>
                <p className="mt-1 break-words text-sm">{claim.value}</p>
                <form
                  action={editProposedClaimAdminAction}
                  className="mt-2 flex flex-wrap gap-2"
                >
                  <input name="claimId" type="hidden" value={claim.id} />
                  <input
                    aria-label={`Edit ${labelProduct(claim.product)} ${labelAttribute(claim.attribute)}`}
                    className="min-h-9 min-w-0 flex-1 rounded-lg border border-border px-2 text-sm"
                    defaultValue={claim.value}
                    name="value"
                  />
                  <button className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold">
                    Save value
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </section>
      <form
        action={publishProposalAdminAction}
        className="grid gap-4 rounded-card border border-border bg-surface p-4"
      >
        <input name="proposalId" type="hidden" value={proposal.id} />
        <h3 className="font-semibold">Claim decisions</h3>
        {rows.map((claim) => (
          <fieldset
            className="flex flex-wrap items-center gap-4 border-t border-border pt-3"
            key={claim.id}
          >
            <legend className="text-sm font-semibold">
              {labelProduct(claim.product)} · {labelAttribute(claim.attribute)}:{" "}
              {claim.value}
            </legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                name={`decision-${claim.id}`}
                required
                type="radio"
                value="approve"
              />
              Approve
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                name={`decision-${claim.id}`}
                required
                type="radio"
                value="reject"
              />
              Reject
            </label>
            {materialClaimIds.has(claim.id) ? (
              <label className="flex items-center gap-2 text-sm text-warn">
                <input
                  name="materialChangeConfirmed"
                  type="checkbox"
                  value={claim.id}
                />
                Confirm this material change
              </label>
            ) : null}
          </fieldset>
        ))}
        <label className="grid gap-1 text-sm font-semibold">
          Public summary
          <textarea
            className="min-h-24 rounded-lg border border-border p-3 font-normal"
            defaultValue={proposal.publicSummary}
            name="publicSummary"
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Change summary
          <textarea
            className="min-h-20 rounded-lg border border-border p-3 font-normal"
            defaultValue="New evidence reviewed by HalalCheck."
            name="changeSummary"
            required
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-11 rounded-lg bg-accent px-4 font-semibold text-white">
            Publish approved findings
          </button>
        </div>
      </form>
      <div className="flex flex-wrap gap-3">
        <form action={rejectProposalAdminAction}>
          <input name="proposalId" type="hidden" value={proposal.id} />
          <button className="min-h-10 rounded-lg border border-border px-4 font-semibold">
            Reject proposal
          </button>
        </form>
        {proposal.investigationId ? (
          <form action={closeProposalUnableToConfirmAction}>
            <input name="proposalId" type="hidden" value={proposal.id} />
            <button className="min-h-10 rounded-lg border border-warn px-4 font-semibold text-warn">
              Close as unable to confirm
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
