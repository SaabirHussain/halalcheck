import type { Metadata } from "next";
import Link from "next/link";
import { NetworkStatus } from "./network-status";
import { DemoModeBanner } from "./demo-mode";
import "./ui-enhancements.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "HalalCheck",
  description: "Community research directory for halal food businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><header className="topbar"><Link className="brand" href="/">Halal<span>Check</span></Link><nav><Link href="/">Explore</Link><Link href="/about">About</Link><Link href="/me/requests">My research</Link></nav><Link className="account" href="/sign-in">Sign in</Link></header><NetworkStatus/><DemoModeBanner/>{children}<nav className="bottom-nav" aria-label="Mobile navigation"><Link href="/">Discover</Link><Link href="/me/saved">Saved</Link><Link href="/me/requests">Requests</Link><Link href="/me/notifications">Alerts</Link><Link href="/sign-in">Account</Link></nav><footer>HalalCheck is a community research directory, not a religious ruling. Findings show evidence and what remains unknown.</footer></body>
    </html>
  );
}
