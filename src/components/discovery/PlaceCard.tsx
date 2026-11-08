"use client";

import Image from "next/image";
import Link from "next/link";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { illustrationForPlace } from "./illustration";
import type { ResearchStatus } from "@/lib/shared/types";
import { GoogleAttribution } from "@/components/ui/GoogleAttribution";

export type DiscoveryPlace = {
  id: string;
  name: string;
  branchName: string;
  category: string;
  cuisine: string | null;
  address: string;
  city: string;
  lat: number;
  lng: number;
  researchStatus: ResearchStatus;
  imageUrl: string | null;
  lastReviewedAt: string | Date | null;
  isDemo: boolean;
  detailsSource: "first_party" | "provider";
  attribution: boolean;
  distanceKm: number | null;
  evidenceChips: string[];
};

function categoryLabel(category: string) {
  if (category === "restaurant") return "Restaurant";
  if (category === "butcher") return "Butcher";
  if (category === "grocery") return "Grocery";
  return "Food business";
}

function formatReviewedDate(value: string | Date | null) {
  if (!value) return "Not yet reviewed";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Not yet reviewed";
  return `Reviewed ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)}`;
}

export function PlaceCard({
  place,
  highlighted,
  onHighlight,
}: {
  place: DiscoveryPlace;
  highlighted: boolean;
  onHighlight: (id: string | null) => void;
}) {
  return (
    <article
      className={`overflow-hidden rounded-card border bg-surface transition-shadow focus-within:ring-2 focus-within:ring-accent/30 hover:shadow-lg ${
        highlighted ? "border-accent shadow-lg" : "border-border shadow-sm"
      }`}
      onMouseEnter={() => onHighlight(place.id)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(place.id)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onHighlight(null);
        }
      }}
    >
      <Link
        aria-label={
          place.branchName && place.branchName !== place.name
            ? `${place.name}, ${place.branchName}`
            : place.name
        }
        className="group block focus:outline-none"
        href={`/places/${place.id}`}
      >
        <div className="relative h-40 overflow-hidden bg-surface-2 sm:h-44">
          <Image
            alt=""
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 36vw"
            src={place.imageUrl ?? illustrationForPlace(place)}
          />
        </div>
        <div className="grid gap-2.5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-xl font-semibold leading-tight text-ink">
                {place.name}
              </h3>
              {place.branchName && place.branchName !== place.name ? (
                <p className="mt-1 text-sm text-muted">{place.branchName}</p>
              ) : null}
            </div>
            {place.isDemo ? <DemoBadge /> : null}
          </div>
          <p className="text-sm text-muted">
            {categoryLabel(place.category)}
            {place.cuisine ? ` · ${place.cuisine}` : ""}
          </p>
          <p className="text-sm leading-snug text-ink">
            {place.city ? `${place.address}, ${place.city}` : place.address}
          </p>
          {place.attribution ? <GoogleAttribution /> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusBadge status={place.researchStatus} />
            {place.distanceKm != null ? (
              <span className="text-xs font-medium text-muted">
                {place.distanceKm.toFixed(1)} km
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted">
            {formatReviewedDate(place.lastReviewedAt)}
          </p>
          {place.evidenceChips.length ? (
            <ul
              aria-label="Published evidence highlights"
              className="flex flex-wrap gap-1.5"
            >
              {place.evidenceChips.slice(0, 2).map((chip) => (
                <li
                  className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent-strong"
                  key={chip}
                >
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
