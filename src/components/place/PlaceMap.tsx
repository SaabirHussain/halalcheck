"use client";

import { useState } from "react";
import { MapLoader } from "@/components/discovery/MapLoader";
import type { DiscoveryPlace } from "@/components/discovery/PlaceCard";

export function PlaceMap({ place }: { place: DiscoveryPlace }) {
  const [highlightedId, setHighlightedId] = useState<string | null>(place.id);

  return (
    <MapLoader
      center={[place.lat, place.lng]}
      className="h-52 min-h-52"
      highlightedId={highlightedId}
      onHighlight={setHighlightedId}
      places={[place]}
    />
  );
}
