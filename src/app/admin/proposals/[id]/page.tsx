import { db } from "@/db";
import { claims, proposedUpdates } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  return (
    <section>
      <h2>Evidence proposal</h2>
      <p>{proposal.status}</p>
      {proposal.flags.map((flag, index) => (
        <article className="finding" key={index}>
          <strong>{flag.type}</strong>
          <p>{flag.detail}</p>
        </article>
      ))}
      {rows.map((claim) => (
        <article className="finding" key={claim.id}>
          <strong>
            {claim.product} · {claim.attribute}
          </strong>
          <p>{claim.value}</p>
        </article>
      ))}
    </section>
  );
}
