CREATE TYPE "public"."branch_details_source" AS ENUM('first_party', 'provider');--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "details_source" "branch_details_source" DEFAULT 'first_party' NOT NULL;--> statement-breakpoint
UPDATE "branches"
SET "details_source" = 'provider'
WHERE "provider_cached_at" IS NOT NULL
  AND "name" = 'Nearby'
  AND "address" = 'Address not available'
  AND "city" = 'Nearby'
  AND EXISTS (
    SELECT 1 FROM "external_place_ids"
    WHERE "external_place_ids"."branch_id" = "branches"."id"
  );--> statement-breakpoint
UPDATE "businesses"
SET "name" = '', "website" = NULL
WHERE EXISTS (
  SELECT 1 FROM "branches"
  WHERE "branches"."business_id" = "businesses"."id"
    AND "branches"."details_source" = 'provider'
);--> statement-breakpoint
UPDATE "branches"
SET "name" = '',
    "address" = '',
    "city" = '',
    "phone" = NULL,
    "website" = NULL,
    "provider_name" = NULL,
    "provider_address" = NULL
WHERE "details_source" = 'provider';--> statement-breakpoint
DELETE FROM "branches"
WHERE "details_source" = 'provider'
  AND "provider_cached_at" < NOW() - INTERVAL '30 days'
  AND NOT EXISTS (
    SELECT 1 FROM "investigations"
    WHERE "investigations"."branch_id" = "branches"."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "branch_follows"
    WHERE "branch_follows"."branch_id" = "branches"."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "favorites"
    WHERE "favorites"."branch_id" = "branches"."id"
  );--> statement-breakpoint
UPDATE "branches"
SET "lat" = 0, "lng" = 0, "provider_cached_at" = NULL
WHERE "provider_cached_at" < NOW() - INTERVAL '30 days';--> statement-breakpoint
UPDATE "branches"
SET "provider_name" = NULL, "provider_address" = NULL;