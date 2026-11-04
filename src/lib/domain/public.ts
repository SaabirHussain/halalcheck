import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  branches,
  businesses,
  certificates,
  claims,
  certifiers,
  publishedRevisions,
  sources,
} from "@/db/schema";
import type { BusinessCategory, ResearchStatus } from "@/lib/shared/types";

const publicBranchColumns = {
  id: branches.id,
  businessId: businesses.id,
  name: sql<string>`CASE
    WHEN ${branches.providerCachedAt} > NOW() - INTERVAL '30 days'
    THEN COALESCE(${branches.providerName}, ${businesses.name})
    ELSE ${businesses.name}
  END`.as("name"),
  branchName: branches.name,
  category: businesses.category,
  cuisine: businesses.cuisine,
  address: sql<string>`CASE
    WHEN ${branches.providerCachedAt} > NOW() - INTERVAL '30 days'
    THEN COALESCE(${branches.providerAddress}, ${branches.address})
    ELSE ${branches.address}
  END`.as("address"),
  city: branches.city,
  lat: branches.lat,
  lng: branches.lng,
  phone: branches.phone,
  website: branches.website,
  imageUrl: branches.imageUrl,
  timezone: branches.timezone,
  researchStatus: branches.researchStatus,
  lastReviewedAt: branches.lastReviewedAt,
  lastConfirmedAt: branches.lastConfirmedAt,
  isDemo: branches.isDemo,
};

export function redactPublicExcerpt(value: string | null) {
  if (!value) return null;
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, "[redacted phone]");
}

export async function getPublicBranch(branchId: string, database: typeof defaultDb = defaultDb) {
  const [branch] = await database
    .select(publicBranchColumns)
    .from(branches)
    .innerJoin(businesses, eq(branches.businessId, businesses.id))
    .where(eq(branches.id, branchId))
    .limit(1);
  if (!branch) return null;

  const [revision] = await database
    .select({
      id: publishedRevisions.id,
      revisionNumber: publishedRevisions.revisionNumber,
      publishedAt: publishedRevisions.publishedAt,
      changeSummary: publishedRevisions.changeSummary,
      publicSummary: publishedRevisions.publicSummary,
      snapshot: publishedRevisions.snapshot,
      outcome: publishedRevisions.outcome,
    })
    .from(publishedRevisions)
    .where(eq(publishedRevisions.branchId, branchId))
    .orderBy(desc(publishedRevisions.revisionNumber))
    .limit(1);

  const publicClaims = await database
    .select({
      id: claims.id,
      product: claims.product,
      attribute: claims.attribute,
      value: claims.value,
      valueEnum: claims.valueEnum,
      evidenceCategory: claims.evidenceCategory,
      confirmedAt: claims.confirmedAt,
      supportingExcerpt: claims.supportingExcerpt,
      sourceId: claims.sourceId,
    })
    .from(claims)
    .where(and(eq(claims.branchId, branchId), eq(claims.status, "published")));
  const claimSources = publicClaims.length
    ? await database
        .select({
          id: sources.id,
          url: sources.url,
          title: sources.title,
          retrievedAt: sources.retrievedAt,
          kind: sources.kind,
          publicExcerpt: sources.publicExcerpt,
          isPublic: sources.isPublic,
        })
        .from(sources)
        .where(
          and(
            or(...publicClaims.map((claim) => eq(sources.id, claim.sourceId ?? ""))),
          ),
        )
    : [];
  const sourceById = new Map(
    claimSources.map((source) => [
      source.id,
      source.isPublic
        ? {
            kind: source.kind,
            url: source.url,
            title: source.title,
            retrievedAt: source.retrievedAt,
            publicExcerpt: source.publicExcerpt,
          }
        : { kind: source.kind, retrievedAt: source.retrievedAt, isPrivate: true as const },
    ]),
  );
  const publicSourceIds = new Set(claimSources.filter((source) => source.isPublic).map((source) => source.id));
  const certificateInfo = await database
    .select({
      id: certificates.id,
      validFrom: certificates.validFrom,
      validUntil: certificates.validUntil,
      coversBranch: certificates.coversBranch,
      reviewStatus: certificates.reviewStatus,
      scopeText: certificates.scopeText,
      products: certificates.products,
      certificateNumber: certificates.certificateNumber,
      certifierName: certifiers.name,
      certifierWebsite: certifiers.website,
    })
    .from(certificates)
    .innerJoin(certifiers, eq(certificates.certifierId, certifiers.id))
    .where(
      and(
        eq(certificates.reviewStatus, "accepted"),
        or(eq(certificates.branchId, branchId), eq(certificates.businessId, branch.businessId)),
      ),
    );

  return {
    ...branch,
    latestRevision: revision
      ? { ...revision, snapshot: revision.snapshot }
      : null,
    claims: publicClaims.map((claim) => ({
      ...claim,
      supportingExcerpt:
        claim.sourceId && publicSourceIds.has(claim.sourceId)
          ? redactPublicExcerpt(claim.supportingExcerpt)
          : null,
      source: claim.sourceId ? sourceById.get(claim.sourceId) ?? null : null,
    })),
    certificates: certificateInfo,
  };
}

export type PublicDiscoveryFilters = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  q?: string;
  category?: BusinessCategory;
  status?: ResearchStatus;
  slaughter?: string;
  certified?: boolean;
  menu?: "full" | "partial";
  limit?: number;
};

export async function listPublicBranches(
  filters: PublicDiscoveryFilters,
  database: typeof defaultDb = defaultDb,
) {
  const where = [];
  if (filters.category) where.push(eq(businesses.category, filters.category));
  if (filters.status) where.push(eq(branches.researchStatus, filters.status));
  if (filters.q) {
    where.push(or(ilike(businesses.name, `%${filters.q}%`), ilike(branches.providerName, `%${filters.q}%`))!);
  }
  if (filters.lat != null && filters.lng != null) {
    const radius = Math.min(Math.max(filters.radiusKm ?? 20, 1), 100);
    const latDelta = radius / 110.574;
    const lngDelta = radius / (111.32 * Math.max(0.01, Math.cos((filters.lat * Math.PI) / 180)));
    where.push(
      and(
        gte(branches.lat, filters.lat - latDelta),
        lte(branches.lat, filters.lat + latDelta),
        gte(branches.lng, filters.lng - lngDelta),
        lte(branches.lng, filters.lng + lngDelta),
      )!,
    );
  }
  const rows = await database
    .select(publicBranchColumns)
    .from(branches)
    .innerJoin(businesses, eq(branches.businessId, businesses.id))
    .where(where.length ? and(...where) : undefined)
    .limit(Math.min(filters.limit ?? 200, 500));

  const claimsForBranches = rows.length
    ? await database
        .select({
          branchId: claims.branchId,
          product: claims.product,
          attribute: claims.attribute,
          valueEnum: claims.valueEnum,
          evidenceCategory: claims.evidenceCategory,
        })
        .from(claims)
        .where(
          and(
            eq(claims.status, "published"),
            or(...rows.map((row) => eq(claims.branchId, row.id))),
          ),
        )
    : [];
  const certsForBranches = rows.length
    ? await database
        .select({ branchId: certificates.branchId })
        .from(certificates)
        .where(
          and(
            eq(certificates.reviewStatus, "accepted"),
            or(...rows.map((row) => eq(certificates.branchId, row.id))),
          ),
        )
    : [];
  const matched = rows.filter((row) => {
    const branchClaims = claimsForBranches.filter((claim) => claim.branchId === row.id);
    if (filters.slaughter && !branchClaims.some((claim) => claim.attribute === "slaughter_method" && claim.valueEnum === filters.slaughter)) return false;
    if (filters.certified != null) {
      const hasCertificate = certsForBranches.some((certificate) => certificate.branchId === row.id);
      if (filters.certified !== hasCertificate) return false;
    }
    if (filters.menu && !branchClaims.some((claim) => claim.attribute === "menu_coverage" && claim.valueEnum === filters.menu)) return false;
    const distanceKm =
      filters.lat == null || filters.lng == null
        ? null
        : haversineKm(filters.lat, filters.lng, row.lat, row.lng);
    if (distanceKm != null && filters.radiusKm != null && distanceKm > filters.radiusKm) return false;
    return true;
  });
  return matched.map((row) => ({
    ...row,
    distanceKm:
      filters.lat == null || filters.lng == null
        ? null
        : Number(haversineKm(filters.lat, filters.lng, row.lat, row.lng).toFixed(1)),
  }));
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const term =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(term), Math.sqrt(1 - term));
}
