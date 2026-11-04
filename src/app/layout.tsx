import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
