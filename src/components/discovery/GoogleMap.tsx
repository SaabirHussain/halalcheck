"use client";

import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import Link from "next/link";
import { useEffect } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { markerColor } from "./map-utils";
import type { DiscoveryPlace } from "./PlaceCard";

const fallbackCenter = { lat: 43.65, lng: -79.38 };
const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";

function MapViewport({ center }: { center?: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    if (map && center) map.setCenter({ lat: center[0], lng: center[1] });
  }, [center, map]);

  return null;
}

export function GoogleMap({
  places,
  highlightedId,
  onHighlight,
  center,
  className = "",
}: {
  places: DiscoveryPlace[];
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
  center?: [number, number];
  className?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const mapCenter = center
    ? { lat: center[0], lng: center[1] }
    : fallbackCenter;
  const highlighted = places.find((place) => place.id === highlightedId);

  return (
    <div
      className={`relative z-0 isolate min-h-48 overflow-hidden rounded-card ${className}`}
    >
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={mapCenter}
          defaultZoom={12}
          mapId={mapId}
          style={{ width: "100%", height: "100%", minHeight: "12rem" }}
        >
          <MapViewport center={center} />
          {places.map((place) => (
            <AdvancedMarker
              key={place.id}
              onClick={() => onHighlight(place.id)}
              onMouseEnter={() => onHighlight(place.id)}
              onMouseLeave={() => onHighlight(null)}
              position={{ lat: place.lat, lng: place.lng }}
              title={place.name}
            >
              <Pin
                background={markerColor(place.researchStatus)}
                borderColor="#FFFFFF"
                glyphColor="#FFFFFF"
              />
            </AdvancedMarker>
          ))}
          {highlighted ? (
            <InfoWindow
              onCloseClick={() => onHighlight(null)}
              position={{ lat: highlighted.lat, lng: highlighted.lng }}
            >
              <div className="grid min-w-44 gap-2 p-1">
                <Link
                  className="font-semibold text-accent underline"
                  href={`/places/${highlighted.id}`}
                >
                  {highlighted.name}
                </Link>
                <span className="text-xs text-muted">
                  {highlighted.branchName}
                </span>
                <StatusBadge
                  className="text-[0.65rem]"
                  status={highlighted.researchStatus}
                />
              </div>
            </InfoWindow>
          ) : null}
        </Map>
      </APIProvider>
    </div>
  );
}
