"use client";

import { X } from "lucide-react";
import type { DiscoveryFilterState } from "./filter-types";

const statusOptions = [
  ["not_researched", "Not researched"],
  ["queued", "Research in progress"],
  ["findings_published", "Findings published"],
  ["unable_to_confirm", "Unable to confirm"],
  ["needs_refresh", "Outdated — needs refresh"],
] as const;

export function FiltersPanel({
  filters,
  activeCount,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  filters: DiscoveryFilterState;
  activeCount: number;
  onChange: (filters: DiscoveryFilterState) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        aria-label="Close filters"
        className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[1px]"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label="Discovery filters"
        className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[1.25rem] border border-border bg-surface shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[min(24rem,100vw)] md:max-h-none md:rounded-none md:border-y-0 md:border-r-0"
        role="dialog"
        aria-modal="true"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:pt-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
                Refine results
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                Filters
              </h2>
            </div>
            <button
              aria-label="Close filters"
              className="grid size-11 place-items-center rounded-full border border-border hover:bg-surface-2"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          <div className="grid gap-5">
            <label className="grid gap-2 text-sm font-semibold">
              Distance
              <select
                className="min-h-11 rounded-xl border border-border bg-surface px-3 font-normal"
                onChange={(event) =>
                  onChange({
                    ...filters,
                    radiusKm: Number(event.currentTarget.value),
                  })
                }
                value={filters.radiusKm}
              >
                {[2, 5, 10, 25].map((distance) => (
                  <option key={distance} value={distance}>
                    Within {distance} km
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Research status
              <select
                className="min-h-11 rounded-xl border border-border bg-surface px-3 font-normal"
                onChange={(event) =>
                  onChange({
                    ...filters,
                    status: event.currentTarget
                      .value as DiscoveryFilterState["status"],
                  })
                }
                value={filters.status ?? ""}
              >
                <option value="">Any status</option>
                {statusOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Reported slaughter method
              <select
                className="min-h-11 rounded-xl border border-border bg-surface px-3 font-normal"
                onChange={(event) =>
                  onChange({
                    ...filters,
                    slaughter: (event.currentTarget.value || undefined) as
                      DiscoveryFilterState["slaughter"] | undefined,
                  })
                }
                value={filters.slaughter ?? ""}
              >
                <option value="">Any reported method</option>
                <option value="hand">Hand-slaughtered</option>
                <option value="machine">Machine-slaughtered</option>
                <option value="mixed">Mixed method</option>
              </select>
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold">
                Certificate reviewed
              </legend>
              <div className="flex gap-3">
                {[
                  ["true", "Yes"],
                  ["false", "No"],
                ].map(([value, label]) => (
                  <label
                    className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-border px-3 text-sm"
                    key={value}
                  >
                    <input
                      checked={filters.certified === value}
                      name="certified"
                      onChange={() =>
                        onChange({
                          ...filters,
                          certified:
                            filters.certified === value
                              ? undefined
                              : (value as "true" | "false"),
                        })
                      }
                      type="checkbox"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-2 text-sm font-semibold">
              Menu coverage
              <select
                className="min-h-11 rounded-xl border border-border bg-surface px-3 font-normal"
                onChange={(event) =>
                  onChange({
                    ...filters,
                    menu: (event.currentTarget.value || undefined) as
                      DiscoveryFilterState["menu"] | undefined,
                  })
                }
                value={filters.menu ?? ""}
              >
                <option value="">Any coverage</option>
                <option value="full">Full menu reported</option>
                <option value="partial">Partial menu reported</option>
              </select>
            </label>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-surface px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5">
          <div className="flex gap-3">
            <button
              className="min-h-11 flex-1 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-surface-2"
              onClick={onClear}
              type="button"
            >
              Clear all
            </button>
            <button
              className="min-h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong"
              onClick={onApply}
              type="button"
            >
              Show results{activeCount ? ` (${activeCount})` : ""}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
