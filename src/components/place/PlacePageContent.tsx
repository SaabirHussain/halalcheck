import Image from "next/image";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { EvidenceLabel } from "@/components/ui/EvidenceLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { getPublicBranch } from "@/lib/domain/public";
import { illustrationForPlace } from "@/components/discovery/illustration";
import type { DiscoveryPlace } from "@/components/discovery/PlaceCard";
import { PlaceActions } from "./PlaceActions";
import { PlaceMap } from "./PlaceMap";

type Place = NonNullable<Awaited<ReturnType<typeof getPublicBranch>>>;
type PublicClaim = Place["claims"][number];

const products: Record<string, string> = {
  chicken: "Chicken",
  beef: "Beef",
  lamb: "Lamb",
  goat: "Goat",
  turkey: "Turkey",
  other_meat: "Other meat",
};
const attributes: Record<string, string> = {
  supplier: "Supplier",
  slaughter_method: "Slaughter method",
  stunning: "Stunning",
  certifier: "Certifier",
};
const practices: Record<string, string> = {
  shared_grill: "Shared grill",
  shared_fryer: "Shared fryer",
  shared_utensils: "Shared utensils",
  shared_storage: "Shared storage",
  separate_preparation: "Separate preparation",
};
const questions: Record<string, string> = {
  chicken_supplier: "Which supplier provides the chicken?",
  chicken_slaughter_method: "What slaughter method is used for the chicken?",
  beef_supplier: "Which supplier provides the beef?",
  lamb_supplier: "Which supplier provides the lamb?",
  certifier: "Which organization certifies the products?",
  certificate: "Can the certificate and its current validity be confirmed?",
  branch_coverage:
    "Does the certification cover this branch and these products?",
  menu_coverage: "Does the information cover the full menu or selected items?",
};
const attributeOrder = [
  "supplier",
  "slaughter_method",
  "stunning",
  "certifier",
] as const;

function displayDate(value: string | Date | null | undefined) {
  if (!value) return "Date not recorded";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function claimFor(claims: PublicClaim[], product: string, attribute: string) {
  return claims.find(
    (claim) => claim.product === product && claim.attribute === attribute,
  );
}

function ClaimValue({
  claim,
  emptyText = "Unknown — not confirmed",
}: {
  claim?: PublicClaim;
  emptyText?: string;
}) {
  if (!claim) {
    return <p className="mt-1 text-sm text-muted">{emptyText}</p>;
  }

  return (
    <div className="mt-1 grid gap-1.5">
      <p className="text-sm font-medium text-ink">{claim.value}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <EvidenceLabel category={claim.evidenceCategory} />
        <span className="text-xs text-muted">
          Confirmed {displayDate(claim.confirmedAt)}
        </span>
      </div>
    </div>
  );
}

function Stepper({ status }: { status: string }) {
  const steps = [
    ["queued", "Request received"],
    ["checking_public_sources", "Public research"],
    ["awaiting_outreach_approval", "Business outreach"],
    ["awaiting_business_response", "Awaiting response"],
    ["reviewing_evidence", "Evidence review"],
  ];
  const currentIndex = steps.findIndex(([key]) => key === status);

  return (
    <section className="rounded-card border border-info/20 bg-info-soft p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-info">
        Research in progress
      </p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-5">
        {steps.map(([key, label], index) => {
          const complete = currentIndex >= 0 && index < currentIndex;
          const active = key === status;
          return (
            <li
              className="flex items-center gap-2 text-sm sm:grid sm:gap-2"
              key={key}
            >
              <span
                aria-hidden="true"
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  complete || active
                    ? "bg-info text-white"
                    : "border border-info/30 bg-surface text-info"
                }`}
              >
                {complete ? "✓" : index + 1}
              </span>
              <span className={active ? "font-semibold text-info" : "text-ink"}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm text-ink">
        Businesses can take days or weeks to reply. We’ll notify people
        following this research.
      </p>
    </section>
  );
}

export function PlacePageContent({
  place,
  signedIn,
  isFollowing,
  isSaved,
}: {
  place: Place;
  signedIn: boolean;
  isFollowing: boolean;
  isSaved: boolean;
}) {
  const meatProducts = [
    "chicken",
    "beef",
    "lamb",
    ...new Set(
      place.claims
        .map((claim) => claim.product)
        .filter(
          (product) =>
            ![
              "chicken",
              "beef",
              "lamb",
              "menu",
              "kitchen",
              "beverages",
              "general",
            ].includes(product),
        ),
    ),
  ];
  const menuClaims = place.claims.filter(
    (claim) => claim.product === "menu" && claim.attribute === "menu_coverage",
  );
  const practiceClaims = place.claims.filter(
    (claim) => claim.product === "kitchen",
  );
  const alcoholClaims = place.claims.filter(
    (claim) =>
      claim.product === "beverages" ||
      claim.attribute === "alcohol_served" ||
      claim.attribute === "pork_served",
  );
  const mapPlace: DiscoveryPlace = {
    id: place.id,
    name: place.name,
    branchName: place.branchName,
    category: place.category,
    cuisine: place.cuisine,
    address: place.address,
    city: place.city,
    lat: place.lat,
    lng: place.lng,
    researchStatus: place.researchStatus,
    imageUrl: place.imageUrl,
    lastReviewedAt: place.lastReviewedAt,
    isDemo: place.isDemo,
    distanceKm: null,
    evidenceChips: [],
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 md:pb-10">
      <section
        aria-label="Place overview"
        className="grid gap-5 md:grid-cols-[1.15fr_0.85fr]"
      >
        <div className="relative min-h-60 overflow-hidden rounded-card bg-surface-2 sm:min-h-80">
          <Image
            alt=""
            className="object-cover"
            fill
            priority
            sizes="(max-width: 767px) 100vw, 60vw"
            src={illustrationForPlace(place)}
          />
        </div>
        <div className="flex flex-col justify-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={place.researchStatus} />
            {place.isDemo ? <DemoBadge /> : null}
          </div>
          {place.researchStatus === "needs_refresh" ? (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
              Findings may be outdated. Current details need a fresh review.
            </p>
          ) : null}
          <p className="text-sm font-semibold text-accent">
            {place.branchName} · {place.category}
            {place.cuisine ? ` · ${place.cuisine}` : ""}
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
            {place.name}
          </h1>
          <p className="text-sm text-muted">
            {place.address}, {place.city}
          </p>
          <p className="text-sm text-muted">
            {place.lastReviewedAt
              ? `Reviewed ${displayDate(place.lastReviewedAt)}`
              : "Not yet reviewed"}
          </p>
        </div>
      </section>

      <div className="my-6">
        <PlaceActions
          activeInvestigation={place.activeInvestigation}
          branchId={place.id}
          isFollowing={isFollowing}
          isSaved={isSaved}
          signedIn={signedIn}
        />
      </div>

      {place.activeInvestigation ? (
        <div className="mb-6">
          <Stepper status={place.activeInvestigation.status} />
        </div>
      ) : null}

      <section className="border-b border-border py-6">
        <h2 className="font-display text-2xl font-semibold">Public summary</h2>
        <p className="mt-3 leading-relaxed text-ink">
          {place.latestRevision?.publicSummary ??
            "Research has not yet been published for this branch. Unknown information is not a negative finding."}
        </p>
      </section>

      <section className="border-b border-border py-6">
        <h2 className="font-display text-2xl font-semibold">
          Findings by product
        </h2>
        <p className="mt-1 text-sm text-muted">
          Each statement is attributed to its evidence source and confirmation
          date.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {meatProducts.map((product) => (
            <article
              className="rounded-card border border-border bg-surface p-4"
              key={product}
            >
              <h3 className="font-display text-xl font-semibold">
                {products[product] ?? "Other meat"}
              </h3>
              <dl className="mt-3 grid gap-4">
                {attributeOrder.map((attribute) => (
                  <div className="border-t border-border pt-3" key={attribute}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {attributes[attribute]}
                    </dt>
                    <dd>
                      <ClaimValue
                        claim={claimFor(place.claims, product, attribute)}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="border-b border-border py-6">
        <h2 className="font-display text-2xl font-semibold">Certificates</h2>
        {place.certificates.length ? (
          <div className="mt-3 grid gap-3">
            {place.certificates.map((certificate) => {
              const expired =
                certificate.validUntil !== null &&
                new Date(`${certificate.validUntil}T23:59:59Z`).getTime() <
                  Date.now();
              return (
                <article
                  className="rounded-card border border-border bg-surface p-4"
                  key={certificate.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold">
                      {certificate.certifierName}
                    </h3>
                    {expired ? (
                      <span className="rounded-full bg-danger-soft px-3 py-1 text-xs font-bold text-danger">
                        Expired certificate
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">Certificate number</dt>
                      <dd className="font-medium">
                        {certificate.certificateNumber ?? "Not listed"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Validity</dt>
                      <dd className="font-medium">
                        {displayDate(certificate.validFrom)} —{" "}
                        {displayDate(certificate.validUntil)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Branch coverage</dt>
                      <dd className="font-medium">
                        {certificate.coversBranch === true
                          ? "This branch is covered"
                          : certificate.coversBranch === false
                            ? "This branch is not covered"
                            : "Unknown — not confirmed"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Products</dt>
                      <dd className="font-medium">
                        {certificate.products.length
                          ? certificate.products
                              .map(
                                (product) =>
                                  products[product] ?? "Other product",
                              )
                              .join(", ")
                          : "Not listed"}
                      </dd>
                    </div>
                  </dl>
                  {certificate.certifierWebsite ? (
                    <a
                      className="mt-3 inline-block text-sm font-semibold text-accent underline underline-offset-2"
                      href={certificate.certifierWebsite}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Visit certifier website
                    </a>
                  ) : null}
                  {expired ? (
                    <p className="mt-3 text-sm text-danger">
                      This certificate is past its listed validity date and
                      needs review.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-surface-2 p-4 text-sm text-muted">
            No certificate has been reviewed for this branch.
          </p>
        )}
      </section>

      <section className="border-b border-border py-6">
        <h2 className="font-display text-2xl font-semibold">Menu coverage</h2>
        {menuClaims.length ? (
          menuClaims.map((claim) => (
            <div className="mt-3 rounded-xl bg-surface p-4" key={claim.id}>
              <ClaimValue claim={claim} />
            </div>
          ))
        ) : (
          <p className="mt-2 text-sm text-muted">Unknown — not confirmed</p>
        )}
      </section>

      <section className="border-b border-border py-6">
        <h2 className="font-display text-2xl font-semibold">
          Kitchen practices
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Object.entries(practices).map(([attribute, label]) => (
            <article
              className="rounded-xl border border-border bg-surface p-4"
              key={attribute}
            >
              <h3 className="text-sm font-semibold">{label}</h3>
              <ClaimValue
                claim={practiceClaims.find(
                  (claim) => claim.attribute === attribute,
                )}
              />
            </article>
          ))}
        </div>
      </section>

      {alcoholClaims.length ? (
        <section className="border-b border-border py-6">
          <h2 className="font-display text-2xl font-semibold">
            Alcohol and pork
          </h2>
          <div className="mt-3 grid gap-3">
            {alcoholClaims.map((claim) => (
              <article
                className="rounded-xl border border-border bg-surface p-4"
                key={claim.id}
              >
                <h3 className="font-semibold">
                  {claim.attribute === "pork_served"
                    ? "Pork served"
                    : claim.attribute === "alcohol_served"
                      ? "Alcohol served"
                      : "Beverage finding"}
                </h3>
                <ClaimValue claim={claim} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-b border-border py-6">
        <h2 className="font-display text-2xl font-semibold">
          Unanswered questions
        </h2>
        {place.unansweredQuestions.length ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink">
            {place.unansweredQuestions.map((question) => (
              <li key={question}>
                {questions[question] ??
                  "Further details have not been confirmed."}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            No additional open questions are listed.
          </p>
        )}
      </section>

      <section className="border-b border-border py-6">
        <h2 className="font-display text-2xl font-semibold">Sources</h2>
        {place.sources.length ? (
          <ul className="mt-3 grid gap-3">
            {place.sources.map((source, index) => {
              if ("isPrivate" in source && source.isPrivate) {
                return (
                  <li
                    className="rounded-xl border border-border bg-surface p-4 text-sm"
                    key={`${source.kind}-${index}`}
                  >
                    <span className="font-semibold">Business email reply</span>
                    <span className="text-muted">
                      {" "}
                      · received {displayDate(source.retrievedAt)} · private
                      correspondence, summarised
                    </span>
                  </li>
                );
              }
              return (
                <li
                  className="rounded-xl border border-border bg-surface p-4"
                  key={`${source.kind}-${index}`}
                >
                  {source.url ? (
                    <a
                      className="font-semibold text-accent underline underline-offset-2"
                      href={source.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {source.title}
                    </a>
                  ) : (
                    <span className="font-semibold">{source.title}</span>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    Retrieved {displayDate(source.retrievedAt)}
                  </p>
                  {source.publicExcerpt ? (
                    <p className="mt-2 text-sm text-muted">
                      {source.publicExcerpt}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            No public sources have been recorded yet.
          </p>
        )}
      </section>

      <section className="border-b border-border py-6">
        <h2 className="font-display text-2xl font-semibold">Change history</h2>
        {place.history.length ? (
          <ol className="mt-3 grid gap-3">
            {place.history.map((revision) => (
              <li
                className="rounded-xl border border-border bg-surface p-4"
                key={revision.id}
              >
                <h3 className="font-semibold">
                  Revision {revision.revisionNumber}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Published {displayDate(revision.publishedAt)}
                  {revision.confirmedAt
                    ? ` · Information confirmed ${displayDate(revision.confirmedAt)}`
                    : ""}
                </p>
                <p className="mt-2 text-sm">{revision.changeSummary}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted">
            No published changes are recorded.
          </p>
        )}
      </section>

      <section className="grid gap-5 py-6 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            Contact and location
          </h2>
          <address className="mt-3 grid gap-2 text-sm not-italic text-muted">
            <span>
              {place.address}, {place.city}
            </span>
            {place.phone ? (
              <a href={`tel:${place.phone}`}>{place.phone}</a>
            ) : null}
            {place.website ? (
              <a
                className="break-all text-accent underline"
                href={place.website}
                rel="noreferrer"
                target="_blank"
              >
                Business website
              </a>
            ) : null}
          </address>
        </div>
        <PlaceMap place={mapPlace} />
      </section>

      <p className="border-t border-border pt-5 text-sm leading-relaxed text-muted">
        HalalCheck organises evidence; it does not issue religious rulings.
        Findings show what has been reviewed and what remains unknown.
      </p>
    </main>
  );
}
