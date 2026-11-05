import { DemoGeocoder } from "./demo";
import { NominatimGeocoder } from "./nominatim";

let warned = false;

export function getGeocoder() {
  if (
    process.env.GEOCODER_PROVIDER === "nominatim" &&
    process.env.NOMINATIM_USER_AGENT
  ) {
    return new NominatimGeocoder(process.env.NOMINATIM_USER_AGENT);
  }
  if (process.env.GEOCODER_PROVIDER === "nominatim" && !warned) {
    warned = true;
    console.warn(
      "Nominatim selected without a user agent; using demo geocoder.",
    );
  }
  return new DemoGeocoder();
}

export type { Geocoder, GeocodeResult } from "./types";
