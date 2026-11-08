import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SupportLink, WebOnlyPage } from "@/components/layout/SupportLink";
import { supportUrl } from "@/lib/support";

export const metadata: Metadata = {
  title: "Support HalalCheck",
};

export default function SupportPage() {
  const href = supportUrl();
  if (!href) notFound();

  return (
    <WebOnlyPage>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
          Support HalalCheck
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">
          Help keep halal research free for everyone.
        </h1>
        <p className="mt-2 leading-relaxed">
          HalalCheck is independently run. Donations pay for hosting, the AI
          that reads business websites and replies, outreach email, and the
          domain.
        </p>
        <h2 className="mt-8 font-display text-xl font-semibold">
          How donations work
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            Donations are made on Ko-fi. Payments are handled by Ko-fi and its
            payment processors (Stripe or PayPal); HalalCheck never sees your
            card details.
          </li>
          <li>
            HalalCheck is not a registered charity, so donations are not
            tax-deductible.
          </li>
          <li>
            Donations never influence research, findings, or which places are
            listed. Businesses cannot pay for a result.
          </li>
        </ul>
        <SupportLink
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 font-semibold text-white hover:bg-accent-strong"
          href={href}
        >
          Donate on Ko-fi
        </SupportLink>
      </main>
    </WebOnlyPage>
  );
}
