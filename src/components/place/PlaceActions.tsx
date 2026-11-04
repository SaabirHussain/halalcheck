"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  requestResearchFromPlaceAction,
  toggleFavoriteFromPlaceAction,
  type PlaceActionState,
} from "@/app/actions";

const initialState: PlaceActionState = {};

export function PlaceActions({
  branchId,
  signedIn,
  activeInvestigation,
  isFollowing,
  isSaved,
}: {
  branchId: string;
  signedIn: boolean;
  activeInvestigation: { followerCount: number } | null;
  isFollowing: boolean;
  isSaved: boolean;
}) {
  const router = useRouter();
  const [researchState, researchAction, researchPending] = useActionState(
    requestResearchFromPlaceAction,
    initialState,
  );
  const [saveState, saveAction, savePending] = useActionState(
    toggleFavoriteFromPlaceAction,
    initialState,
  );

  useEffect(() => {
    if (researchState.ok || saveState.ok) router.refresh();
  }, [researchState.ok, saveState.ok, router]);

  const signInHref = `/sign-in?next=${encodeURIComponent(`/places/${branchId}`)}`;
  const requestLabel = activeInvestigation
    ? `Join investigation (${activeInvestigation.followerCount} following)`
    : "Request research";

  return (
    <section
      aria-label="Place actions"
      className="grid gap-3 sm:flex sm:flex-wrap"
    >
      {!signedIn ? (
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 font-semibold text-white hover:bg-accent-strong"
          href={signInHref}
        >
          {activeInvestigation
            ? "Sign in to follow investigation"
            : "Sign in to request research"}
        </Link>
      ) : isFollowing ? (
        <button
          aria-disabled="true"
          className="min-h-11 rounded-xl bg-accent-soft px-4 font-semibold text-accent-strong"
          type="button"
        >
          Following investigation
        </button>
      ) : (
        <form action={researchAction}>
          <input name="branchId" type="hidden" value={branchId} />
          <button
            className="min-h-11 w-full rounded-xl bg-accent px-4 font-semibold text-white hover:bg-accent-strong disabled:opacity-60 sm:w-auto"
            disabled={researchPending}
            type="submit"
          >
            {researchPending ? "Updating…" : requestLabel}
          </button>
        </form>
      )}

      {signedIn ? (
        <form action={saveAction}>
          <input name="branchId" type="hidden" value={branchId} />
          <button
            aria-pressed={saveState.favorited ?? isSaved}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-4 font-semibold hover:border-accent sm:w-auto"
            disabled={savePending}
            type="submit"
          >
            {savePending
              ? "Updating…"
              : (saveState.favorited ?? isSaved)
                ? "Saved"
                : "Save place"}
          </button>
        </form>
      ) : (
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 font-semibold hover:border-accent"
          href={signInHref}
        >
          Sign in to save
        </Link>
      )}

      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 font-semibold hover:border-accent"
        href={`/places/${branchId}/report`}
      >
        Report an issue
      </Link>

      {researchState.message || researchState.error ? (
        <p className="basis-full text-sm text-accent" role="status">
          {researchState.message ?? researchState.error}
        </p>
      ) : null}
      {saveState.message || saveState.error ? (
        <p className="basis-full text-sm text-accent" role="status">
          {saveState.message ?? saveState.error}
        </p>
      ) : null}
    </section>
  );
}
