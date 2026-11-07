import { SupportLink, WebOnly } from "@/components/layout/SupportLink";
import { supportUrl } from "@/lib/support";

export default function About() {
  const donateUrl = supportUrl();
  return (
    <main className="page">
      <span className="eyebrow">About HalalCheck</span>
      <h1>Research that is shared, reviewed, and clear about uncertainty.</h1>
      <p>
        HalalCheck is a community research directory. Findings cite sources, are
        reviewed before publication, and are not religious rulings. Unknown
        information is shown as unknown rather than as a negative claim.
      </p>
      <h2>How research works</h2>
      <p>
        Community members can request research. Our team gathers public sources
        and, when appropriate, asks businesses for clarification. Private
        correspondence is never published verbatim.
      </p>
      {donateUrl ? (
        <WebOnly>
          <section>
            <h2>Support HalalCheck</h2>
            <p>
              HalalCheck is free and independently run. If it helps you, you
              can support hosting and research costs.
            </p>
            <SupportLink
              className="underline underline-offset-2 hover:text-accent"
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
