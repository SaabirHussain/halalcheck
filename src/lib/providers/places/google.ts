import type { PlacesProvider, PlacesSearch, PlaceResult } from "./types";

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
};

export class GooglePlacesProvider implements PlacesProvider {
  constructor(private readonly apiKey: string) {}

  async searchNearby(input: PlacesSearch): Promise<PlaceResult[]> {
    const url = input.query
      ? "https://places.googleapis.com/v1/places:searchText"
      : "https://places.googleapis.com/v1/places:searchNearby";
    const body = input.query
      ? {
          textQuery: input.query,
          locationBias: {
            circle: {
              center: { latitude: input.lat, longitude: input.lng },
              radius: Math.min(input.radiusKm * 1000, 50_000),
            },
          },
        }
      : {
          includedTypes: ["restaurant", "grocery_store", "butcher_shop"],
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: { latitude: input.lat, longitude: input.lng },
              radius: Math.min(input.radiusKm * 1000, 50_000),
            },
          },
        };
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.types",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Places provider returned ${response.status}.`);
    const payload = (await response.json()) as { places?: GooglePlace[] };
    return (payload.places ?? []).flatMap((place) => {
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (!place.id || !place.displayName?.text || !place.formattedAddress || lat == null || lng == null) {
        return [];
      }
      return [
        {
          provider: "google",
          externalId: place.id,
          name: place.displayName.text,
          address: place.formattedAddress,
          lat,
          lng,
          category: input.category ?? "restaurant",
          phone: place.nationalPhoneNumber,
          website: place.websiteUri,
          attribution: "Places data © Google",
        },
      ];
    });
  }
}
