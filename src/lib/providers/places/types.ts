import type { BusinessCategory } from "@/lib/shared/types";

export type PlacesSearch = {
  lat: number;
  lng: number;
  radiusKm: number;
  category?: BusinessCategory;
  query?: string;
};

export type PlaceResult = {
  provider: string;
  externalId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: BusinessCategory;
};

export type PlaceDetails = {
  id: string;
  displayName: string;
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  types: string[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
};

export interface PlacesProvider {
  searchNearby(input: PlacesSearch): Promise<PlaceResult[]>;
  getPlace(
    externalId: string,
    level: "summary" | "contact",
  ): Promise<PlaceDetails | null>;
}
