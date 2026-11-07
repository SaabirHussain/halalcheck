import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { NativeShell } from "@/components/layout/NativeShell";
import { getCurrentUser } from "@/lib/auth/sessions";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, count, eq, isNull } from "drizzle-orm";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["600"],
});

export const metadata: Metadata = {
  title: "HalalCheck",
  description: "Community research directory for halal food businesses.",
};

export const viewport: Viewport = {
  themeColor: "#faf6ef",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const [unread] = user
    ? await db
        .select({ value: count() })
        .from(notifications)
        .where(
          and(eq(notifications.userId, user.id), isNull(notifications.readAt)),
        )
    : [{ value: 0 }];

  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] font-sans text-ink md:pb-0">
        <NativeShell
          userId={user?.id ?? null}
          pushEnabled={process.env.PUSH_PROVIDER === "fcm-apns"}
        />
        <SiteHeader user={user} unreadCount={unread?.value ?? 0} />
        <OfflineBanner />
        <DemoBanner />
        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
        <MobileTabBar user={user} unreadCount={unread?.value ?? 0} />
        <SiteFooter />
      </body>
    </html>
  );
}
