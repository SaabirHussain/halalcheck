"use client";

import { useState } from "react";
import { MapLoader } from "@/components/discovery/MapLoader";
import type { DiscoveryPlace } from "@/components/discovery/PlaceCard";

export function PlaceMap({ place }: { place: DiscoveryPlace }) {
  const [highlightedId, setHighlightedId] = useState<string | null>(place.id);
  if (
    place.detailsSource === "provider" &&
    place.lat === 0 &&
    place.lng === 0
  ) {
    return null;
  }
  const center =
    place.detailsSource === "provider" &&
    !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? undefined
      : ([place.lat, place.lng] as [number, number]);

  return (
    <MapLoader
      center={center}
      className="h-52 min-h-52"
      highlightedId={highlightedId}
      onHighlight={setHighlightedId}
      places={[place]}
    />
  );
}
