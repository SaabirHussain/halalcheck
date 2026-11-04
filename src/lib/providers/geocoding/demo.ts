import type { Geocoder } from "./types";

const demoTowns = [
  { label: "Demo City", lat: 43.65, lng: -79.38 },
  { label: "Demo North", lat: 43.72, lng: -79.4 },
  { label: "Demo East", lat: 43.66, lng: -79.28 },
  { label: "Demo West", lat: 43.64, lng: -79.48 },
];

export class DemoGeocoder implements Geocoder {
  async search(query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [demoTowns[0]!];
    return demoTowns.filter((town) => town.label.toLowerCase().includes(normalized));
  }
}
