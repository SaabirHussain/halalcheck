import type { Geocoder, GeocodeResult } from "./types";

export class NominatimGeocoder implements Geocoder {
  private lastRequestAt = 0;

  constructor(private readonly userAgent: string) {}

  async search(query: string): Promise<GeocodeResult[]> {
    const waitMs = Math.max(0, 1000 - (Date.now() - this.lastRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.lastRequestAt = Date.now();
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    const response = await fetch(url, {
      headers: { "User-Agent": this.userAgent },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Geocoder returned ${response.status}.`);
    const data = (await response.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
    }>;
    return data.map((item) => ({
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));
  }
}
