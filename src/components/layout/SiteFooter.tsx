import { SupportLink } from "@/components/layout/SupportLink";
import { supportUrl } from "@/lib/support";

export function SiteFooter() {
  const donateUrl = supportUrl();
  return (
    <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-center text-xs text-muted sm:px-6">
      <p>
        HalalCheck organises evidence; it does not issue religious rulings.
        Unknown information is not a negative finding.
      </p>
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
        <p>
          Map data ©{" "}
          <a
            className="underline underline-offset-2 hover:text-accent"
            href="https://www.openstreetmap.org/copyright"
            rel="noreferrer"
            target="_blank"
          >
            OpenStreetMap contributors
          </a>
          .
        </p>
      ) : null}
      <p className="flex justify-center gap-4">
        <a
          className="underline underline-offset-2 hover:text-accent"
          href="/terms"
        >
          Terms of Use
        </a>
        <a
          className="underline underline-offset-2 hover:text-accent"
          href="/privacy"
        >
          Privacy Policy
        </a>
        {donateUrl ? (
          <SupportLink
            className="underline underline-offset-2 hover:text-accent"
            href="/support"
          >
            Support HalalCheck
          </SupportLink>
        ) : null}
      </p>
    </footer>
  );
}
