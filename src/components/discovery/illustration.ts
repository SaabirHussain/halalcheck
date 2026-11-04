import type { BusinessCategory } from "@/lib/shared/types";

export type IllustrationPlace = {
  category: BusinessCategory | string;
  cuisine: string | null;
  name: string;
};

export function illustrationForPlace(place: IllustrationPlace) {
  const text = `${place.name} ${place.cuisine ?? ""}`.toLowerCase();
  if (place.category === "butcher") return "/images/butcher.svg";
  if (place.category === "grocery") return "/images/grocery.svg";
  if (
    text.includes("shawarma") ||
    text.includes("kebab") ||
    text.includes("zaytoon")
  ) {
    return "/images/shawarma.svg";
  }
  if (text.includes("burger") || text.includes("american"))
    return "/images/burger.svg";
  if (
    text.includes("curry") ||
    text.includes("indian") ||
    text.includes("south asian")
  ) {
    return "/images/curry.svg";
  }
  return "/images/grill.svg";
}
