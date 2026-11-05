import { emailNotificationsAction } from "@/app/actions";

export function EmailNotificationsForm({ enabled }: { enabled: boolean }) {
  return (
    <form action={emailNotificationsAction} className="grid gap-4">
      <label className="flex min-h-11 items-center gap-3">
        <input
          defaultChecked={enabled}
          className="size-5 accent-accent"
          name="emailNotifications"
          type="checkbox"
        />
        <span className="font-medium">Email me when research is published</span>
      </label>
      <p className="rounded-xl bg-info-soft p-3 text-sm text-info">
        Demo mode: emails are captured, never sent.
      </p>
      <button
        className="min-h-11 w-fit rounded-xl bg-accent px-4 font-semibold text-white"
        type="submit"
      >
        Save preferences
      </button>
    </form>
  );
}
