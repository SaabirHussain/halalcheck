export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <p className="mb-5 rounded-lg border border-warn/20 bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
        Review with a qualified advisor before public launch.
      </p>
      <h1 className="font-display text-3xl font-semibold">Terms of Use</h1>
      <p className="mt-3 text-sm text-muted">Last updated: November 2026</p>
      <div className="mt-6 grid gap-5 leading-relaxed">
        <section>
          <h2 className="font-semibold">What HalalCheck does</h2>
          <p className="mt-1">
            HalalCheck organizes community research about food businesses and
            the evidence behind published findings. It is not a religious
            authority and does not issue religious rulings. Information may be
            incomplete, uncertain, or out of date.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Accounts and research requests</h2>
          <p className="mt-1">
            You may create an account using your email address and password,
            save places, follow research, submit corrections, and request
            research. Keep your account credentials private and provide
            accurate information.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Public findings and private material</h2>
          <p className="mt-1">
            Administrators review evidence before findings are published.
            Published findings and their supporting public sources may be
            visible to everyone. Business correspondence, draft outreach,
            account information, and uploaded evidence are private operational
            material and are not automatically published.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Business outreach and uploads</h2>
          <p className="mt-1">
            HalalCheck may email a business to request information about a
            research question. Provider-sourced business details must first be
            confirmed by an administrator from the business’s own website or
            signage. If you upload documents or other evidence, you confirm
            that you may submit them for review. Administrators may inspect
            those files as part of research or moderation.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Third-party services</h2>
          <p className="mt-1">
            Google Maps and Places provide map and place-search services.
            Google Maps Platform content is shown with the required attribution
            and on Google Maps when it appears on a map. Place IDs may be
            retained; place coordinates are cached for no more than 30
            consecutive days; other Google Places content is not stored.
            OpenAI may process public source material and business responses
            for evidence analysis. Our email provider (Resend) may process
            email addresses and message content when email features are
            enabled.
          </p>
          <p className="mt-2">
            Your use of Google Maps Platform content is subject to{" "}
            <a
              className="underline underline-offset-2"
              href="https://maps.google.com/help/terms_maps/"
              rel="noreferrer"
              target="_blank"
            >
              Google Maps Platform Terms of Service
            </a>{" "}
            and the{" "}
            <a
              className="underline underline-offset-2"
              href="https://policies.google.com/privacy"
              rel="noreferrer"
              target="_blank"
            >
              Google Privacy Policy
            </a>
            .
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Service availability</h2>
          <p className="mt-1">
            The service and its content are provided for community research.
            HalalCheck may correct, update, or remove content and may change or
            suspend features. Do not rely on a listing as a guarantee about a
            business or its products.
          </p>
        </section>
      </div>
    </main>
  );
}
