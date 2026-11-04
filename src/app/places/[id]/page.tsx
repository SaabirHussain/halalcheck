import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublicBranch } from "@/lib/domain/public";
import { requestResearchAction } from "@/app/actions";
export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await getPublicBranch(id);
  if (!place) notFound();
  return (
    <main className="detail">
      <Image src={place.imageUrl ?? "/images/halalcheck-market.svg"} alt="" width={800} height={420} />
      <span className="badge">{place.researchStatus.replaceAll("_", " ")}</span>
      <h1>{place.name}</h1>
      <p className="muted">{place.branchName} · {place.address}, {place.city}</p>
      <p>{place.latestRevision?.publicSummary ?? "Research has not yet been published for this branch."}</p>
      <form action={requestResearchAction}>
        <input type="hidden" name="branchId" value={place.id} />
        <button className="button">Request shared research</button>
      </form>
      <Link className="button secondary" href={`/places/${id}/report`}>Suggest a correction</Link>
      <h2>Published findings</h2>
      {place.claims.length ? place.claims.map((claim) => (
        <article className="finding" key={claim.id}>
          <h3>{claim.product} · {claim.attribute.replaceAll("_", " ")}</h3>
          <p>{claim.value}</p>
          <small className="muted">Confirmed {claim.confirmedAt ?? "date not recorded"} · {claim.source?.kind ?? "Source not available"}</small>
          {claim.supportingExcerpt && <blockquote>{claim.supportingExcerpt}</blockquote>}
        </article>
      )) : <p className="empty">No reviewed findings are currently published. This is not a negative finding.</p>}
      <h2>Certificates</h2>
      {place.certificates.map((certificate) => (
        <article className="finding" key={certificate.id}>
          <strong>{certificate.certifierName}</strong>
          <p>{certificate.certificateNumber ?? "Certificate number not listed"} · valid until {certificate.validUntil ?? "unknown"}</p>
          <a href={certificate.certifierWebsite ?? "#"}>{certificate.certifierWebsite}</a>
        </article>
      ))}
    </main>
  );
}
