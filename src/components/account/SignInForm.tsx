"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type FormActionState } from "@/app/actions";

const initialState: FormActionState = {};

export function SignInForm({
  next = "/",
  demoMode,
}: {
  next?: string;
  demoMode: boolean;
}) {
  const [state, action, pending] = useActionState(signInAction, initialState);

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
      <label className="grid gap-1.5 text-sm font-semibold" htmlFor="email">
        Email
        <input
          autoComplete="email"
          className="min-h-11 rounded-xl border border-border px-3 font-normal"
          id="email"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold" htmlFor="password">
        Password
        <input
          autoComplete="current-password"
          className="min-h-11 rounded-xl border border-border px-3 font-normal"
          id="password"
          name="password"
          required
          type="password"
        />
      </label>
      <button
        className="mt-2 min-h-11 rounded-xl bg-accent px-4 font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {demoMode ? (
        <div className="mt-2 rounded-xl bg-accent-soft p-3 text-sm">
          <p className="font-semibold text-accent-strong">Demo accounts</p>
          <p className="mt-1 text-muted">Choose an account to fill the form.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="min-h-10 rounded-lg border border-accent/30 bg-surface px-3 text-sm font-semibold"
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (!form) return;
                (form.elements.namedItem("email") as HTMLInputElement).value =
                  "user@demo.halalcheck.test";
                (
                  form.elements.namedItem("password") as HTMLInputElement
                ).value = "DemoUser!2026";
              }}
              type="button"
            >
              Fill member
            </button>
            <button
              className="min-h-10 rounded-lg border border-accent/30 bg-surface px-3 text-sm font-semibold"
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (!form) return;
                (form.elements.namedItem("email") as HTMLInputElement).value =
                  "admin@demo.halalcheck.test";
                (
                  form.elements.namedItem("password") as HTMLInputElement
                ).value = "DemoAdmin!2026";
              }}
              type="button"
            >
              Fill admin
            </button>
          </div>
        </div>
      ) : null}
      <p className="text-sm text-muted">
        New here?{" "}
        <Link
          className="underline underline-offset-2"
          href={`/sign-up?next=${encodeURIComponent(next)}`}
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
