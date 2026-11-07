import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SupportLink } from "@/components/layout/SupportLink";
import { supportUrl } from "@/lib/support";

export const metadata: Metadata = {
  title: "Support HalalCheck",
};

export default function SupportPage() {
  const href = supportUrl();
  if (!href) notFound();

  return (
    <main className="page">
      <span className="eyebrow">Support HalalCheck</span>
      <h1>Help keep halal research free for everyone.</h1>
      <p>
        HalalCheck is independently run. Donations pay for hosting, the AI that
        reads business websites and replies, outreach email, and the domain.
      </p>
      <h2>How donations work</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          Donations are made on Ko-fi. Payments are handled by Ko-fi and its
          payment processors (Stripe or PayPal); HalalCheck never sees your card
          details.
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
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 font-semibold text-white hover:bg-accent-strong"
        href={href}
      >
        Donate on Ko-fi
      </SupportLink>
    </main>
  );
}
