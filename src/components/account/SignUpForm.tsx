"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction, type FormActionState } from "@/app/actions";

const initialState: FormActionState = {};

export function SignUpForm({ next = "/" }: { next?: string }) {
  const [state, action, pending] = useActionState(signUpAction, initialState);

  return (
    <form action={action} className="mt-5 grid gap-3">
      <input name="next" type="hidden" value={next} />
      {state.error ? (
        <p
          className="rounded-xl bg-danger-soft p-3 text-sm text-danger"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <label
        className="grid gap-1.5 text-sm font-semibold"
        htmlFor="displayName"
      >
        Name
        <input
          autoComplete="name"
          className="min-h-11 rounded-xl border border-border px-3 font-normal"
          id="displayName"
          maxLength={100}
          name="displayName"
          required
        />
      </label>
      <label
        className="grid gap-1.5 text-sm font-semibold"
        htmlFor="signup-email"
      >
        Email
        <input
          autoComplete="email"
          className="min-h-11 rounded-xl border border-border px-3 font-normal"
          id="signup-email"
          name="email"
          required
          type="email"
        />
      </label>
      <label
        className="grid gap-1.5 text-sm font-semibold"
        htmlFor="signup-password"
      >
        Password (12 characters minimum)
        <input
          autoComplete="new-password"
          className="min-h-11 rounded-xl border border-border px-3 font-normal"
          id="signup-password"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </label>
      <button
        className="mt-2 min-h-11 rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link
          className="underline underline-offset-2"
          href={`/sign-in?next=${encodeURIComponent(next)}`}
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
