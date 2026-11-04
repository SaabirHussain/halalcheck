"use client";

import { useActionState, useState } from "react";
import { correctionAction, type FormActionState } from "@/app/actions";

const initialState: FormActionState = {};
const acceptedTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function CorrectionForm({ branchId }: { branchId: string }) {
  const [state, action, pending] = useActionState(
    correctionAction,
    initialState,
  );
  const [fileError, setFileError] = useState("");

  if (state.success) {
    return (
      <div
        className="rounded-card border border-accent/20 bg-accent-soft p-5"
        role="status"
      >
        <h2 className="font-display text-xl font-semibold">
          Submitted for review
        </h2>
        <p className="mt-2 text-sm text-ink">{state.success}</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid min-w-0 gap-4">
      <input name="branchId" type="hidden" value={branchId} />
      {state.error || fileError ? (
        <p
          className="rounded-xl bg-danger-soft p-3 text-sm text-danger"
          role="alert"
        >
          {fileError || state.error}
        </p>
      ) : null}
      <label
        className="grid min-w-0 gap-1.5 text-sm font-semibold"
        htmlFor="correction-body"
      >
        What should we review?
        <textarea
          className="min-h-32 min-w-0 w-full rounded-xl border border-border bg-surface px-3 py-2 font-normal"
          id="correction-body"
          maxLength={5000}
          minLength={10}
          name="body"
          required
        />
      </label>
      <label
        className="grid min-w-0 gap-1.5 text-sm font-semibold"
        htmlFor="correction-url"
      >
        Optional source URL
        <input
          className="min-h-11 min-w-0 w-full rounded-xl border border-border bg-surface px-3 font-normal"
          id="correction-url"
          name="url"
          type="url"
        />
      </label>
      <label
        className="grid min-w-0 gap-1.5 text-sm font-semibold"
        htmlFor="correction-file"
      >
        Optional document or image (PDF, PNG, JPG, or WebP; up to 5 MB)
        <input
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          className="min-h-11 min-w-0 w-full rounded-xl border border-border bg-surface p-2 text-sm font-normal"
          id="correction-file"
          name="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            setFileError(
              file &&
                (!acceptedTypes.includes(file.type) ||
                  file.size > 5 * 1024 * 1024)
                ? "Choose a PDF, PNG, JPG, or WebP file no larger than 5 MB."
                : "",
            );
          }}
          type="file"
        />
      </label>
      <label className="flex min-w-0 min-h-11 items-center gap-2 text-sm">
        <input name="isOwnerSubmission" type="checkbox" />I am the owner or
        manager of this business
      </label>
      <p className="text-xs text-muted">
        Attachments are private and only available to the review team.
      </p>
      <button
        className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-60"
        disabled={pending || Boolean(fileError)}
        type="submit"
      >
        {pending ? "Submitting…" : "Submit correction"}
      </button>
    </form>
  );
}
