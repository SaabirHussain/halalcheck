import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  branches,
  corrections,
  evidenceDocuments,
} from "@/db/schema";
import {
  convertCorrectionAdminAction,
  reviewCorrectionAdminAction,
} from "@/app/admin/actions";
import { formatAdminDateTime, humanizeLabel } from "@/lib/labels";
import { hydrateAdminBranchRows } from "@/lib/domain/admin-place-references";
import { GoogleAttribution } from "@/components/ui/GoogleAttribution";

export default async function CorrectionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [correction] = await db
    .select({
      id: corrections.id,
      body: corrections.body,
      url: corrections.url,
      isOwnerSubmission: corrections.isOwnerSubmission,
      status: corrections.status,
      adminNote: corrections.adminNote,
      createdAt: corrections.createdAt,
      branchId: branches.id,
      detailsSource: branches.detailsSource,
      branchName: branches.name,
      businessName: businesses.name,
      address: branches.address,
      city: branches.city,
      evidenceId: evidenceDocuments.id,
      filename: evidenceDocuments.originalFilename,
      mime: evidenceDocuments.mime,
      sizeBytes: evidenceDocuments.sizeBytes,
    })
    .from(corrections)
    .innerJoin(branches, eq(corrections.branchId, branches.id))
    .innerJoin(businesses, eq(branches.businessId, businesses.id))
    .leftJoin(
      evidenceDocuments,
      eq(corrections.evidenceDocumentId, evidenceDocuments.id),
    )
    .where(eq(corrections.id, id))
    .limit(1);

  if (!correction) {
    return <p className="text-muted">Correction not found.</p>;
  }
  const [place] = await hydrateAdminBranchRows([
    {
      branchId: correction.branchId,
      detailsSource: correction.detailsSource,
      business: correction.businessName,
      branch: correction.branchName,
      address: correction.address,
      city: correction.city,
    },
  ]);

  return (
    <section className="grid min-w-0 gap-5">
      <header className="rounded-card border border-border bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
          {correction.isOwnerSubmission
            ? "Owner or manager submission"
            : "Community correction"}
        </p>
        <h2 className="mt-1 break-words font-display text-2xl font-semibold">
          {place!.business}
          {place!.branch ? ` · ${place!.branch}` : ""}
        </h2>
        {place!.googleMapsUrl ? (
          <div className="mt-2">
            <GoogleAttribution />
            <a
              className="ml-2 text-sm font-semibold text-accent underline"
              href={place!.googleMapsUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              View on Google Maps
            </a>
          </div>
        ) : null}
        <p className="mt-2 text-sm text-muted">
          {humanizeLabel(correction.status)} · submitted{" "}
          {formatAdminDateTime(correction.createdAt)}
        </p>
      </header>
      <section className="rounded-card border border-border bg-surface p-4">
        <h3 className="font-semibold">Correction details</h3>
        <p className="mt-2 break-words whitespace-pre-wrap text-sm">
          {correction.body}
        </p>
        {correction.url ? (
          <a
            className="mt-3 inline-block break-all text-sm font-semibold text-accent underline"
            href={correction.url}
            rel="noreferrer"
            target="_blank"
          >
            Owner-provided reference
          </a>
        ) : null}
        {correction.evidenceId ? (
          <a
            className="mt-3 block break-all text-sm font-semibold text-accent underline"
            href={`/api/admin/evidence/${correction.evidenceId}`}
          >
            Download {correction.filename} ({correction.mime},{" "}
            {Math.ceil(correction.sizeBytes! / 1024)} KB)
          </a>
        ) : (
          <p className="mt-3 text-sm text-muted">No attachment was provided.</p>
        )}
      </section>
      <section className="rounded-card border border-border bg-surface p-4">
        <h3 className="font-semibold">Review decision</h3>
        <form action={reviewCorrectionAdminAction} className="mt-3 grid gap-3">
          <input name="correctionId" type="hidden" value={correction.id} />
          <label className="grid gap-1 text-sm font-semibold">
            Review note
            <textarea
              className="min-h-24 rounded-lg border border-border p-3 font-normal"
              defaultValue={correction.adminNote ?? ""}
              name="adminNote"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-white"
              name="decision"
              value="accepted"
            >
              Accept
            </button>
            <button
              className="min-h-10 rounded-lg border border-border px-4 font-semibold"
              name="decision"
              value="rejected"
            >
              Reject
            </button>
          </div>
        </form>
        {correction.status === "accepted" ? (
          <form action={convertCorrectionAdminAction} className="mt-4">
            <input name="correctionId" type="hidden" value={correction.id} />
            <button className="min-h-10 rounded-lg border border-accent px-4 font-semibold text-accent">
              Convert to refresh investigation
            </button>
          </form>
        ) : null}
      </section>
    </section>
  );
}
