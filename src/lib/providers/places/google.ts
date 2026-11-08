import type { BusinessCategory } from "@/lib/shared/types";
import type {
  PlaceDetails,
  PlacesProvider,
  PlacesSearch,
  PlaceResult,
} from "./types";

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
  photos?: Array<{
    name?: string;
    authorAttributions?: Array<{
      displayName?: string;
      uri?: string;
    }>;
    googleMapsUri?: string;
  }>;
};

const categoryWords: Record<BusinessCategory, string> = {
  restaurant: "restaurant",
  butcher: "butcher",
  grocery: "grocery",
};

function categoryForTypes(
  types: string[] | undefined,
  fallback: BusinessCategory,
): BusinessCategory {
  if (types?.includes("butcher_shop")) return "butcher";
  if (types?.includes("grocery_store")) return "grocery";
  return fallback;
}

export class GooglePlacesProvider implements PlacesProvider {
  constructor(private readonly apiKey: string) {}

  async searchNearby(input: PlacesSearch): Promise<PlaceResult[]> {
    const url = "https://places.googleapis.com/v1/places:searchText";
    const body = {
      textQuery:
        input.query?.trim() ||
        `halal ${input.category ? categoryWords[input.category] : "restaurant"}`,
      locationBias: {
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
          "places.id,places.displayName,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(`Places provider returned ${response.status}.`);
    const payload = (await response.json()) as { places?: GooglePlace[] };
    return (payload.places ?? []).flatMap((place) => {
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (
        !place.id ||
        !place.displayName?.text ||
        !place.formattedAddress ||
        lat == null ||
        lng == null
      ) {
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
          category: categoryForTypes(place.types, input.category ?? "restaurant"),
        },
      ];
    });
  }

  async getPlace(
    externalId: string,
    level: "summary" | "contact",
  ): Promise<PlaceDetails | null> {
    const fields =
      "id,displayName,formattedAddress,location,types,photos" +
      (level === "contact" ? ",websiteUri,nationalPhoneNumber" : "");
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(externalId)}`,
      {
        headers: {
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": fields,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok)
      throw new Error(`Places provider returned ${response.status}.`);
    const place = (await response.json()) as GooglePlace;
    if (
      !place.id ||
      !place.displayName?.text ||
      !place.formattedAddress ||
      place.location?.latitude == null ||
      place.location.longitude == null
    ) {
      return null;
    }
    const photo = place.photos?.[0];
    return {
      id: place.id,
      displayName: place.displayName.text,
      formattedAddress: place.formattedAddress,
      location: {
        latitude: place.location.latitude,
        longitude: place.location.longitude,
      },
      types: place.types ?? [],
      ...(level === "contact" && place.websiteUri
        ? { websiteUri: place.websiteUri }
        : {}),
      ...(level === "contact" && place.nationalPhoneNumber
        ? { nationalPhoneNumber: place.nationalPhoneNumber }
        : {}),
      ...(photo?.name
        ? {
            photo: {
              name: photo.name,
              authorName:
                photo.authorAttributions?.[0]?.displayName ?? null,
              authorUri: photo.authorAttributions?.[0]?.uri ?? null,
              googleMapsUri: photo.googleMapsUri ?? null,
            },
          }
        : {}),
    };
  }
}
