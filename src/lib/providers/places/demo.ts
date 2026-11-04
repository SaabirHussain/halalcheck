import type { PlacesProvider } from "./types";
import { demoScenarios } from "@/demo/scenarios";
import type { PlacesSearch, PlaceResult } from "./types";

export class DemoPlacesProvider implements PlacesProvider {
  async searchNearby(input: PlacesSearch): Promise<PlaceResult[]> {
    return demoScenarios.flatMap((scenario, index) => {
      if (input.category && scenario.category !== input.category) return [];
      if (input.query && !`${scenario.business} ${scenario.cuisine}`.toLowerCase().includes(input.query.toLowerCase())) {
        return [];
      }
      const lat = 43.65 + Math.floor(index / 5) * 0.017;
      const lng = -79.38 + (index % 5) * 0.015;
      const distance = distanceKm(input.lat, input.lng, lat, lng);
      if (distance > input.radiusKm) return [];
      return [{
        provider: "demo",
        externalId: `demo:${scenario.key}`,
        name: scenario.business,
        address: scenario.address,
        lat,
        lng,
        category: scenario.category,
        ...(scenario.key === "cedar"
          ? { website: "https://cedar.demo.halalcheck.test/" }
          : scenario.key === "olive"
            ? { website: "https://olive.demo.halalcheck.test/" }
            : {}),
        attribution: "Fictional HalalCheck demo data",
      }];
    });
  }
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
