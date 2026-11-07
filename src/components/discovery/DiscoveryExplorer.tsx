"use client";

import Link from "next/link";
import { LocateFixed, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { isNativeApp } from "@/lib/native/platform";
import { MapLoader } from "./MapLoader";
import { FiltersPanel } from "./FiltersPanel";
import { PlaceCard, type DiscoveryPlace } from "./PlaceCard";
import {
  defaultDiscoveryFilters,
  type DiscoveryFilterState,
} from "./filter-types";

const categories = [
  { value: undefined, label: "All" },
  { value: "restaurant", label: "Restaurants" },
  { value: "butcher", label: "Butchers" },
  { value: "grocery", label: "Grocery" },
] as const;

function activeFilterCount(filters: DiscoveryFilterState) {
  return [
    filters.category,
    filters.status,
    filters.slaughter,
    filters.certified,
    filters.menu,
    filters.radiusKm !== defaultDiscoveryFilters.radiusKm,
  ].filter(Boolean).length;
}

function isNativeLocationTimeout(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "OS-PLUG-GLOC-0010"
  );
}

function toSearchParams(filters: DiscoveryFilterState) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.slaughter) params.set("slaughter", filters.slaughter);
  if (filters.certified) params.set("certified", filters.certified);
  if (filters.menu) params.set("menu", filters.menu);
  if (
    filters.radiusKm !== defaultDiscoveryFilters.radiusKm ||
    (filters.lat !== undefined && filters.lng !== undefined)
  ) {
    params.set("radiusKm", String(filters.radiusKm));
  }
  if (filters.lat !== undefined && filters.lng !== undefined) {
    params.set("lat", String(filters.lat));
    params.set("lng", String(filters.lng));
    if (filters.area) params.set("area", filters.area);
  }
  return params.toString();
}

export function DiscoveryExplorer({
  places,
  initialFilters,
  notice,
}: {
  places: DiscoveryPlace[];
  initialFilters: DiscoveryFilterState;
  notice?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState(initialFilters);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [searchValue, setSearchValue] = useState(initialFilters.q);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mapMode, setMapMode] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const activeCount = activeFilterCount(filters);
  const hasActiveFilters =
    activeCount > 0 ||
    filters.q.trim().length > 0 ||
    (filters.lat !== undefined && filters.lng !== undefined);

  useEffect(() => {
    setFilters(initialFilters);
    setDraftFilters(initialFilters);
    setSearchValue(initialFilters.q);
  }, [initialFilters]);

  function navigate(nextFilters: DiscoveryFilterState) {
    setFilters(nextFilters);
    setDraftFilters(nextFilters);
    const query = toSearchParams(nextFilters);
    startTransition(() =>
      router.push(query ? `/?${query}` : "/", { scroll: false }),
    );
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ ...filters, q: searchValue });
  }

  function clearFilters() {
    setSearchValue("");
    setLocationMessage("");
    setManualLocation("");
    setFilterOpen(false);
    navigate(defaultDiscoveryFilters);
  }

  async function requestLocation() {
    setLocationMessage("");
    const updateLocation = (latitude: number, longitude: number) => {
      navigate({
        ...filters,
        lat: Number(latitude.toFixed(6)),
        lng: Number(longitude.toFixed(6)),
        area: "Near you",
      });
      setLocationMessage("");
    };
    if (isNativeApp()) {
      try {
        const permission = await Geolocation.requestPermissions();
        if (
          permission.location !== "granted" &&
          permission.coarseLocation !== "granted"
        ) {
          setLocationMessage(
            "Location access was denied. Enter a city or address to search nearby.",
          );
          return;
        }
        let position: Awaited<
          ReturnType<typeof Geolocation.getCurrentPosition>
        >;
        try {
          position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            enableLocationFallback: true,
            timeout: 15_000,
            maximumAge: 0,
          });
        } catch (error) {
          if (!isNativeLocationTimeout(error)) throw error;
          position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            enableLocationFallback: true,
            timeout: 10_000,
            maximumAge: 60_000,
          });
        }
        updateLocation(position.coords.latitude, position.coords.longitude);
      } catch {
        setLocationMessage(
          "We couldn’t determine your location. Enter a city or address to search nearby.",
        );
      }
      return;
    }
    if (!navigator.geolocation) {
      setLocationMessage(
        "Location is unavailable in this browser. Enter a city or address instead.",
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateLocation(coords.latitude, coords.longitude);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. Enter a city or address to search nearby."
            : "We couldn’t determine your location. Enter a city or address to search nearby.";
        setLocationMessage(message);
      },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function submitManualLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualLocation.trim()) return;
    setGeocoding(true);
    setLocationMessage("");
    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(manualLocation.trim())}`,
      );
      const result = (await response.json()) as {
        results?: Array<{ label: string; lat: number; lng: number }>;
        error?: string;
      };
      const first = result.results?.[0];
      if (!response.ok || !first) {
        setLocationMessage(
          result.error ??
            "We couldn’t find that place. Try another city or address.",
        );
        return;
      }
      navigate({
        ...filters,
        lat: first.lat,
        lng: first.lng,
        area: first.label.split(",")[0] ?? first.label,
      });
      setManualLocation("");
    } catch {
      setLocationMessage(
        "Location search is temporarily unavailable. Please try again.",
      );
    } finally {
      setGeocoding(false);
    }
  }

  const center: [number, number] =
    filters.lat !== undefined && filters.lng !== undefined
      ? [filters.lat, filters.lng]
      : [43.65, -79.38];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 md:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Community research directory
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight sm:text-3xl">
            Know what’s known. See what’s still open.
          </h1>
        </div>
        <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium">
          <MapPin aria-hidden="true" size={17} />
          {filters.area || "Demo City"}
        </span>
      </div>

      <form
        className="relative flex min-w-0 flex-col gap-3 sm:flex-row"
        onSubmit={submitSearch}
      >
        <label className="sr-only" htmlFor="place-search">
          Search businesses, dishes, or neighbourhoods
        </label>
        <input
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 pr-14 text-base shadow-sm placeholder:text-muted/80"
          id="place-search"
          onChange={(event) => setSearchValue(event.currentTarget.value)}
          placeholder="Search a place, dish, or neighbourhood"
          type="search"
          value={searchValue}
        />
        <button
          aria-label="Search places"
          className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg bg-accent text-white hover:bg-accent-strong disabled:opacity-60 sm:static sm:h-12 sm:w-auto sm:grid-flow-col sm:gap-2 sm:translate-y-0 sm:px-5"
          disabled={isPending}
          type="submit"
        >
          <Search aria-hidden="true" size={19} />
          <span className="sr-only sm:not-sr-only">Search</span>
        </button>
      </form>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          aria-label="Business category"
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
        >
          {categories.map((category) => {
            const selected = filters.category === category.value;
            return (
              <button
                aria-pressed={selected}
                className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface text-ink hover:border-accent"
                }`}
                key={category.label}
                onClick={() =>
                  navigate({
                    ...filters,
                    category: category.value,
                  })
                }
                type="button"
              >
                {category.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:border-accent"
            onClick={requestLocation}
            type="button"
          >
            <LocateFixed aria-hidden="true" size={17} />
            Use my location
          </button>
          <button
            aria-expanded={filterOpen}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:border-accent"
            onClick={() => {
              setDraftFilters(filters);
              setFilterOpen(true);
            }}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" size={17} />
            Filters{activeCount ? ` · ${activeCount}` : ""}
          </button>
        </div>
      </div>

      {locationMessage ? (
        <div className="mt-3 rounded-xl border border-warn/30 bg-warn-soft p-3 text-sm text-ink">
          <p className="mb-2" role="status">
            {locationMessage}
          </p>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={submitManualLocation}
          >
            <label className="sr-only" htmlFor="manual-location">
              Enter a city or address
            </label>
            <input
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3"
              id="manual-location"
              onChange={(event) => setManualLocation(event.currentTarget.value)}
              placeholder="City or address"
              value={manualLocation}
            />
            <button
              className="min-h-11 rounded-lg bg-accent px-4 font-semibold text-white disabled:opacity-60"
              disabled={geocoding}
              type="submit"
            >
              {geocoding ? "Searching…" : "Search area"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="my-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <p aria-live="polite" className="text-sm text-muted">
          <span className="font-semibold text-ink">{places.length}</span>{" "}
          {places.length === 1 ? "place" : "places"} to explore
        </p>
        <div
          aria-label="Discovery view"
          className="inline-flex rounded-xl border border-border bg-surface p-1 md:hidden"
          role="group"
        >
          <button
            aria-pressed={!mapMode}
            className={`min-h-9 rounded-lg px-4 text-sm font-semibold ${
              mapMode ? "text-muted" : "bg-accent text-white"
            }`}
            onClick={() => setMapMode(false)}
            type="button"
          >
            List
          </button>
          <button
            aria-pressed={mapMode}
            className={`min-h-9 rounded-lg px-4 text-sm font-semibold ${
              mapMode ? "bg-accent text-white" : "text-muted"
            }`}
            onClick={() => setMapMode(true)}
            type="button"
          >
            Map
          </button>
        </div>
        {activeCount ? (
          <button
            className="hidden min-h-10 text-sm font-semibold text-accent underline underline-offset-4 hover:text-accent-strong sm:inline-flex"
            onClick={clearFilters}
            type="button"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {notice ? (
        <p
          className="mb-4 rounded-lg border border-warn/20 bg-warn-soft px-3 py-2 text-sm text-warn"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {places.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface p-8 text-center">
          <h2 className="font-display text-2xl font-semibold">
            {hasActiveFilters
              ? "No places match these filters"
              : "No places have been added yet"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {hasActiveFilters
              ? "Try another category, neighbourhood, or research status."
              : "The directory is ready for its first published place."}
          </p>
          {hasActiveFilters ? (
            <button
              className="mt-5 min-h-11 rounded-xl bg-accent px-5 font-semibold text-white"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.06fr)_minmax(24rem,0.94fr)] lg:items-start">
          <section
            aria-label="Place results"
            aria-busy={isPending}
            className={`grid gap-4 sm:grid-cols-2 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-2 ${
              mapMode ? "hidden md:grid" : "grid"
            }`}
          >
            {places.map((place) => (
              <PlaceCard
                highlighted={highlightedId === place.id}
                key={place.id}
                onHighlight={setHighlightedId}
                place={place}
              />
            ))}
          </section>
          <section
            aria-label="Map of places"
            role="region"
            className={`${mapMode ? "block" : "hidden"} lg:sticky lg:top-28 lg:block lg:h-[calc(100vh-9rem)]`}
          >
            <MapLoader
              center={center}
              className="h-[calc(100dvh-41rem)] min-h-48 md:h-[28rem] lg:h-full"
              highlightedId={highlightedId}
              onHighlight={setHighlightedId}
              places={places}
            />
          </section>
        </div>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        Findings describe the available evidence, not a religious ruling.{" "}
        <Link
          className="underline underline-offset-2 hover:text-accent"
          href="/about"
        >
          Learn about our methodology
        </Link>
      </p>

      {filterOpen ? (
        <FiltersPanel
          activeCount={activeFilterCount(draftFilters)}
          filters={draftFilters}
          onApply={() => {
            navigate(draftFilters);
            setFilterOpen(false);
          }}
          onChange={setDraftFilters}
          onClear={clearFilters}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}
    </main>
  );
}
