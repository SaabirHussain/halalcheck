import { and, eq, inArray } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import { externalPlaceIds } from "@/db/schema";

type Database = typeof defaultDb;

export type AdminPlaceReference = {
  provider: string;
  externalId: string;
};

export type AdminBranchRow = {
  branchId: string | null;
  detailsSource: string | null;
  business: string | null;
  branch: string | null;
};

export function googleMapsPlaceUrl(externalId: string) {
  return `https://www.google.com/maps/search/?api=1&query=place&query_place_id=${encodeURIComponent(externalId)}`;
}

export async function loadAdminPlaceReferences(
  branchIds: readonly string[],
  database: Database = defaultDb,
) {
  const uniqueBranchIds = [...new Set(branchIds)];
  if (!uniqueBranchIds.length)
    return new Map<string, AdminPlaceReference>();
  const references = await database
    .select({
      branchId: externalPlaceIds.branchId,
      provider: externalPlaceIds.provider,
      externalId: externalPlaceIds.externalId,
    })
    .from(externalPlaceIds)
    .where(
      and(
        inArray(externalPlaceIds.branchId, uniqueBranchIds),
        eq(externalPlaceIds.provider, "google"),
      ),
    );
  return new Map(
    references.map((reference) => [reference.branchId, reference]),
  );
}

export async function hydrateAdminBranchRows<
  T extends AdminBranchRow,
>(
  rows: T[],
  database: Database = defaultDb,
  placeReferences?: ReadonlyMap<string, AdminPlaceReference>,
): Promise<Array<T & { googleMapsUrl: string | null }>> {
  const providerBranchIds = rows.flatMap((row) =>
    row.detailsSource === "provider" && row.branchId ? [row.branchId] : [],
  );
  const references =
    placeReferences ??
    (await loadAdminPlaceReferences(providerBranchIds, database));
  return rows.map((row) => {
    if (row.detailsSource !== "provider") {
      return { ...row, googleMapsUrl: null };
    }
    const reference = row.branchId ? references.get(row.branchId) : undefined;
    return {
      ...row,
      business: "Unconfirmed Google place",
      branch: "",
      googleMapsUrl:
        reference?.provider === "google"
          ? googleMapsPlaceUrl(reference.externalId)
          : null,
    };
  });
}
