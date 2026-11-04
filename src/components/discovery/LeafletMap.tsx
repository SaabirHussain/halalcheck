"use client";

import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { useEffect } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { DiscoveryPlace } from "./PlaceCard";

const fallbackCenter: [number, number] = [43.65, -79.38];
const tileUrl =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ??
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function markerColor(status: DiscoveryPlace["researchStatus"]) {
  if (status === "findings_published") return "#1F5C3F";
  if (status === "needs_refresh" || status === "unable_to_confirm")
    return "#B45309";
  if (status === "not_researched") return "#6B665D";
  return "#1D4E89";
}

function MapViewport({ center }: { center: [number, number] }) {
  const map = useMap();
  const [latitude, longitude] = center;

  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom(), { animate: false });

    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });
    resizeObserver.observe(container);

    const animationFrame = window.requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [latitude, longitude, map]);

  return null;
}

export function LeafletMap({
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
  const mapCenter = center ?? fallbackCenter;

  return (
    <div
      className={`relative z-0 isolate min-h-48 overflow-hidden rounded-card ${className}`}
    >
      <MapContainer
        center={mapCenter}
        className="h-full min-h-48 w-full"
        scrollWheelZoom
        zoom={12}
      >
        <MapViewport center={mapCenter} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          maxZoom={19}
          url={tileUrl}
        />
        {places.map((place) => {
          const color = markerColor(place.researchStatus);
          const active = highlightedId === place.id;
          return (
            <CircleMarker
              center={[place.lat, place.lng]}
              eventHandlers={{
                click: () => onHighlight(place.id),
                mouseover: () => onHighlight(place.id),
                mouseout: () => onHighlight(null),
              }}
              fillColor={color}
              fillOpacity={active ? 1 : 0.82}
              key={place.id}
              pathOptions={{ color: "#FFFFFF", weight: active ? 4 : 2 }}
              radius={active ? 12 : 9}
            >
              <Popup>
                <div className="grid min-w-44 gap-2 p-1">
                  <Link
                    className="font-semibold text-accent underline"
                    href={`/places/${place.id}`}
                  >
                    {place.name}
                  </Link>
                  <span className="text-xs text-muted">{place.branchName}</span>
                  <StatusBadge
                    className="text-[0.65rem]"
                    status={place.researchStatus}
                  />
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
