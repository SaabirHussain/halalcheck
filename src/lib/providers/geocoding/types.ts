export type GeocodeResult = { label: string; lat: number; lng: number };

export interface Geocoder {
  search(query: string): Promise<GeocodeResult[]>;
}
