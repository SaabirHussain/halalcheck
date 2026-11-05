export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <p className="mb-5 rounded-lg border border-warn/20 bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
        Review with a qualified advisor before public launch.
      </p>
      <h1 className="font-display text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted">Last updated: November 2026</p>
      <div className="mt-6 grid gap-5 leading-relaxed">
        <section>
          <h2 className="font-semibold">Information we handle</h2>
          <p className="mt-1">
            HalalCheck handles account email addresses, password hashes,
            display names, account settings, saved places, research requests,
            follows, corrections, and evidence files you upload. We also
            process public business websites and sources, research findings,
            and correspondence with businesses. Requests to sign in, search,
            or use protected features may include an IP address for security
            and rate limiting.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Public and private information</h2>
          <p className="mt-1">
            Findings and public-source citations may be published after
            administrator review. Business outreach, replies, account records,
            uploaded evidence, and internal review notes are private and are
            not automatically published. A business response may be summarized
            publicly with its source and date when reviewed and approved.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">How information is used</h2>
          <p className="mt-1">
            We use information to provide accounts, manage research requests,
            review evidence, communicate with businesses, send account
            notifications, moderate submissions, protect the service, and
            improve the directory. Uploaded files may be reviewed by
            administrators handling the related request or correction.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Service providers</h2>
          <p className="mt-1">
            Google Maps and Places process location and place-search requests
            and provide map or place content. Place IDs may be kept
            indefinitely, coordinates are cached for at most 30 consecutive
            days, and other Google Places content is not stored. Google Maps
            content is attributed and displayed on Google Maps when shown on a
            map.
          </p>
          <p className="mt-2">
            OpenAI may process public web pages and business responses to help
            extract or review evidence. Our email provider (Resend) may process
            recipient addresses and message content to send or receive outreach
            and notifications when configured. These services process
            information to provide their respective features.
          </p>
          <p className="mt-2">
            See Google’s{" "}
            <a
              className="underline underline-offset-2"
              href="https://maps.google.com/help/terms_maps/"
              rel="noreferrer"
              target="_blank"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              className="underline underline-offset-2"
              href="https://policies.google.com/privacy"
              rel="noreferrer"
              target="_blank"
            >
              Privacy Policy
            </a>{" "}
            for Google Maps Platform.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Retention and choices</h2>
          <p className="mt-1">
            Account, research, evidence, and correspondence records are kept as
            needed to operate the service, review findings, and maintain an
            audit trail. You can manage email-notification preferences in
            account settings. For account or privacy requests, contact the
            service operator using the contact information provided with the
            deployed service.
          </p>
        </section>
      </div>
    </main>
  );
}
