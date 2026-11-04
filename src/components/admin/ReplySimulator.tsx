"use client";

import { useState } from "react";
import { simulateInboundReplyAction } from "@/app/admin/actions";

const presetReplies = {
  vague: "All our meat is halal.",
  certified: "Our chicken is certified.",
  clarification:
    "Our chicken supplier is Green Valley Poultry and it is hand-slaughtered. Beef comes from Prairie Meats. We are certified by Demo Halal Certification Council.",
  staff: "Our staff don't know.",
  optout: "STOP",
  refusal: "Please do not contact us again.",
  conflicting:
    "Our chicken is hand-slaughtered, but it is also machine-slaughtered.",
} as const;

export function ReplySimulator({
  investigationId,
}: {
  investigationId: string;
}) {
  const [reply, setReply] = useState<string>(presetReplies.vague);

  return (
    <section className="min-w-0 rounded-card border border-border bg-surface p-4">
      <h3 className="font-semibold">Reply simulator</h3>
      <p className="mt-1 text-sm text-muted">
        Simulation — nothing is sent or received externally.
      </p>
      <form
        action={simulateInboundReplyAction}
        className="mt-3 grid min-w-0 gap-3"
      >
        <input name="investigationId" type="hidden" value={investigationId} />
        <label
          className="grid min-w-0 gap-1 text-sm font-semibold"
          htmlFor="reply-preset"
        >
          Preset
          <select
            className="min-h-11 min-w-0 w-full rounded-lg border border-border px-3 font-normal"
            id="reply-preset"
            onChange={(event) => {
              const value = event.currentTarget
                .value as keyof typeof presetReplies;
              if (value in presetReplies) setReply(presetReplies[value]);
              else setReply("");
            }}
          >
            <option value="vague">{presetReplies.vague}</option>
            <option value="certified">{presetReplies.certified}</option>
            <option value="clarification">{presetReplies.clarification}</option>
            <option value="staff">{presetReplies.staff}</option>
            <option value="optout">{presetReplies.optout}</option>
            <option value="refusal">{presetReplies.refusal}</option>
            <option value="conflicting">{presetReplies.conflicting}</option>
            <option value="custom">Custom reply</option>
          </select>
        </label>
        <label
          className="grid min-w-0 gap-1 text-sm font-semibold"
          htmlFor="simulated-reply"
        >
          Editable reply
          <textarea
            className="min-h-28 min-w-0 w-full rounded-lg border border-border p-3 font-normal"
            id="simulated-reply"
            name="reply"
            onChange={(event) => setReply(event.currentTarget.value)}
            value={reply}
          />
        </label>
        <button className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-white">
          Simulate reply
        </button>
      </form>
    </section>
  );
}
