import type { PlacesProvider } from "./types";
import { DemoPlacesProvider } from "./demo";
import { GooglePlacesProvider } from "./google";

let warned = false;

export function getPlacesProvider(): PlacesProvider {
  if (process.env.PLACES_PROVIDER === "google" && process.env.GOOGLE_PLACES_API_KEY) {
    return new GooglePlacesProvider(process.env.GOOGLE_PLACES_API_KEY);
  }
  if (process.env.PLACES_PROVIDER === "google" && !warned) {
    warned = true;
    console.warn("Google Places selected without API key; using demo provider.");
  }
  return new DemoPlacesProvider();
}

export type { PlacesProvider, PlacesSearch, PlaceResult } from "./types";
