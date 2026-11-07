import { SupportLink, WebOnly } from "@/components/layout/SupportLink";
import { supportUrl } from "@/lib/support";

export default function About() {
  const donateUrl = supportUrl();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
        About HalalCheck
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold">
        Research that is shared, reviewed, and clear about uncertainty.
      </h1>
      <p className="mt-2 leading-relaxed">
        HalalCheck is a community research directory. Findings cite sources, are
        reviewed before publication, and are not religious rulings. Unknown
        information is shown as unknown rather than as a negative claim.
      </p>
      <h2 className="mt-8 font-display text-xl font-semibold">
        How research works
      </h2>
      <p className="mt-2 leading-relaxed">
        Community members can request research. Our team gathers public sources
        and, when appropriate, asks businesses for clarification. Private
        correspondence is never published verbatim.
      </p>
      {donateUrl ? (
        <WebOnly>
          <section>
            <h2 className="mt-8 font-display text-xl font-semibold">
              Support HalalCheck
            </h2>
            <p className="mt-2 leading-relaxed">
              HalalCheck is free and independently run. If it helps you, you can
              support hosting and research costs.
            </p>
            <SupportLink
              className="mt-3 inline-block font-semibold text-accent underline underline-offset-2"
              href="/support"
            >
              Ways to support
            </SupportLink>
          </section>
        </WebOnly>
      ) : null}
    </main>
  );
}
