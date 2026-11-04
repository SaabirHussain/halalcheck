import { db } from "@/db";
import {
  auditEvents,
  branches,
  businesses,
  certificates,
  corrections,
  investigations,
  outreachMessages,
  proposedUpdates,
} from "@/db/schema";
import { approveDraftAction } from "@/app/actions";
import { eq } from "drizzle-orm";

type AdminRow = {
  id: string;
  label: string;
  detail?: string | null;
  href?: string;
};

export default async function AdminSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  let rows: AdminRow[] = [];
  if (section === "investigations") {
    rows = (
      await db
        .select({
          id: investigations.id,
          status: investigations.status,
          stageDetail: investigations.stageDetail,
          name: businesses.name,
        })
        .from(investigations)
        .innerJoin(branches, eq(investigations.branchId, branches.id))
        .innerJoin(businesses, eq(branches.businessId, businesses.id))
    ).map((row) => ({
      id: row.id,
      label: `${row.name} · ${row.status}`,
      detail: row.stageDetail,
      href: `/admin/investigations/${row.id}`,
    }));
  }
  if (section === "proposals") {
    rows = (
      await db
        .select({
          id: proposedUpdates.id,
          status: proposedUpdates.status,
          name: businesses.name,
        })
        .from(proposedUpdates)
        .innerJoin(branches, eq(proposedUpdates.branchId, branches.id))
        .innerJoin(businesses, eq(branches.businessId, businesses.id))
    ).map((row) => ({
      id: row.id,
      label: `${row.name} · ${row.status}`,
      href: `/admin/proposals/${row.id}`,
    }));
  }
  if (section === "certificates")
    rows = (await db.select().from(certificates)).map((row) => ({
      id: row.id,
      label: row.certificateNumber ?? "Certificate review",
      detail: row.reviewStatus,
    }));
  if (section === "corrections")
    rows = (await db.select().from(corrections)).map((row) => ({
      id: row.id,
      label: row.status,
      detail: row.body,
    }));
  if (section === "audit")
    rows = (await db.select().from(auditEvents).limit(100)).map((row) => ({
      id: row.id,
      label: row.action,
      detail: row.entityType,
    }));
  if (section === "outreach")
    rows = (
      await db
        .select()
        .from(outreachMessages)
        .where(eq(outreachMessages.status, "draft"))
    ).map((row) => ({
      id: row.id,
      label: `${row.kind} · ${row.status}`,
      detail: row.bodyText,
    }));
  if (section === "refresh")
    rows = (
      await db
        .select()
        .from(investigations)
        .where(eq(investigations.kind, "refresh"))
    ).map((row) => ({
      id: row.id,
      label: row.status,
      detail: row.stageDetail,
    }));
  return (
    <section>
      <h2>{section.replaceAll("_", " ")}</h2>
      {rows.length ? (
        rows.map((row) => (
          <article className="finding" key={row.id}>
            {row.href ? (
              <a href={row.href}>
                <strong>{row.label}</strong>
              </a>
            ) : (
              <strong>{row.label}</strong>
            )}
            <p className="muted">{row.detail ?? row.id}</p>
            {section === "outreach" && (
              <form action={approveDraftAction}>
                <input type="hidden" name="messageId" value={row.id} />
                <label>
                  <input type="checkbox" name="approveContact" /> Approve
                  contact endpoint
                </label>
                <button className="button">Approve and send</button>
              </form>
            )}
          </article>
        ))
      ) : (
        <p className="empty">No items to review.</p>
      )}
    </section>
  );
}
