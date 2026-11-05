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
  phone?: string;
  website?: string;
  attribution?: string;
};

export interface PlacesProvider {
  searchNearby(input: PlacesSearch): Promise<PlaceResult[]>;
}
