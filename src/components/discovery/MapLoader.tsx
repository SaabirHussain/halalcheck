"use client";

import dynamic from "next/dynamic";
import type { DiscoveryPlace } from "./PlaceCard";

const LeafletMap = dynamic(
  () => import("./LeafletMap").then((module) => module.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div
        aria-label="Loading map"
        className="min-h-80 animate-pulse rounded-card bg-surface-2"
        role="status"
      />
    ),
  },
);

export function MapLoader({
  places,
  highlightedId,
  onHighlight,
  center,
  className,
}: {
  places: DiscoveryPlace[];
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
  center?: [number, number];
  className?: string;
}) {
  return (
    <LeafletMap
      center={center}
      className={className}
      highlightedId={highlightedId}
      onHighlight={onHighlight}
      places={places}
    />
  );
}
