import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  getPublicBranch,
  hydrateProviderBranches,
} from "@/lib/domain/public";
import { getCurrentUser } from "@/lib/auth/sessions";
import { db } from "@/db";
import { favorites, investigationSubscriptions } from "@/db/schema";
import { PlacePageContent } from "@/components/place/PlacePageContent";

export default async function PlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [publicPlace, user] = await Promise.all([
    getPublicBranch(id),
    getCurrentUser(),
  ]);
  if (!publicPlace) notFound();
  const [place] = await hydrateProviderBranches([publicPlace]);
  const active = place.activeInvestigation;
  const [saved, subscription] = user
    ? await Promise.all([
        db
          .select({ id: favorites.id })
          .from(favorites)
          .where(and(eq(favorites.branchId, id), eq(favorites.userId, user.id)))
          .limit(1),
        active
          ? db
              .select({ id: investigationSubscriptions.id })
              .from(investigationSubscriptions)
              .where(
                and(
                  eq(investigationSubscriptions.investigationId, active.id),
                  eq(investigationSubscriptions.userId, user.id),
                ),
              )
              .limit(1)
          : Promise.resolve([]),
      ])
    : [[], []];

  return (
    <PlacePageContent
      isFollowing={Boolean(active && subscription[0])}
      isSaved={Boolean(saved[0])}
      place={place}
      signedIn={Boolean(user)}
    />
  );
}
