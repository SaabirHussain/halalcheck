import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { JobHandler, JobQueue } from "@/lib/jobs/types";
import type { db as defaultDb } from "@/db";
import {
  branches,
  externalPlaceIds,
  businesses,
  claims,
  certificates,
  certifiers,
  contactEndpoints,
  investigations,
  notifications,
  outreachMessages,
  outreachSettings,
  outreachThreads,
  pushDevices,
  sources,
} from "@/db/schema";
import { getAIProvider } from "@/lib/providers/ai";
import type { AIProvider } from "@/lib/providers/ai/types";
import { SSRFSafeFetcher } from "@/lib/providers/fetcher";
import { createOutreachDraft, sendOutreach } from "@/lib/domain/outreach";
import {
  applyFirstPartyBusinessDetails,
  waitingForAutomaticBusinessDetails,
} from "@/lib/domain/admin";
import { addressesMatch } from "@/lib/domain/address-match";
import {
  classifyBusinessEmails,
  isThirdPartyListingUrl,
} from "@/lib/domain/contact-classification";
import {
  isSiteUrlAlreadyFetched,
  selectSameSiteLinks,
} from "@/lib/domain/site-links";
import { parseInboundReply, reviewEvidence } from "@/lib/domain/claims";
import { notifyFollowers } from "@/lib/domain/notifications";
import { getPushProvider } from "@/lib/providers/push";
import { reconcileInvestigations, refreshScan } from "@/lib/domain/refresh";
import { isExcerptInText } from "@/lib/providers/ai/openai";
import { getPlacesProvider } from "@/lib/providers/places";
import type { PlacesProvider } from "@/lib/providers/places";
import { consumeGoogleDetailsLimit } from "@/lib/providers/places/limits";

type Database = typeof defaultDb;
type Payload = Record<string, unknown>;
type HandlerDependencies = {
  aiProvider?: AIProvider;
  placesProvider?: PlacesProvider;
  fetcher?: Pick<SSRFSafeFetcher, "fetch">;
};
const workerActor = { type: "worker" } as const;

export function buildJobHandlers(
  database: Database,
  queue: JobQueue,
  dependencies: HandlerDependencies = {},
): Record<string, JobHandler<Payload>> {
  return {
    "investigation.public_research": async (payload) => {
      const investigationId = requiredString(
        payload.investigationId,
        "investigationId",
      );
      const [investigation] = await database
        .select()
        .from(investigations)
        .where(eq(investigations.id, investigationId))
        .limit(1);
      if (!investigation || !investigation.isActive || investigation.paused)
        return;
      const [branch] = await database
        .select({
          id: branches.id,
          name: branches.name,
          businessId: branches.businessId,
          website: branches.website,
          businessWebsite: businesses.website,
          businessName: businesses.name,
          detailsSource: branches.detailsSource,
        })
        .from(branches)
        .innerJoin(businesses, eq(branches.businessId, businesses.id))
        .where(eq(branches.id, investigation.branchId))
        .limit(1);
      if (!branch) throw new Error("Branch not found.");
      let website = branch.website ?? branch.businessWebsite;
      let googleFormattedAddress: string | null = null;
      if (branch.detailsSource === "provider") {
        const placesProvider =
          dependencies.placesProvider ?? getPlacesProvider();
        const [externalPlace] = await database
          .select({
            provider: externalPlaceIds.provider,
            externalId: externalPlaceIds.externalId,
          })
          .from(externalPlaceIds)
          .where(eq(externalPlaceIds.branchId, branch.id))
          .limit(1);
        website = null;
        if (!externalPlace) throw new Error("Provider place ID is unavailable.");
        if (
          externalPlace.provider === "google" &&
          !(await consumeGoogleDetailsLimit(database, "agent"))
        ) {
          await database
            .update(investigations)
            .set({
              stageDetail: "Waiting for Google lookup quota; will retry automatically.",
              updatedAt: new Date(),
            })
            .where(eq(investigations.id, investigationId));
          return;
        }
        let details: Awaited<ReturnType<PlacesProvider["getPlace"]>>;
        try {
          details = await placesProvider.getPlace(
            externalPlace.externalId,
            "contact",
          );
        } catch (error) {
          throw new Error(sanitizeMessage(error));
        }
        if (!details) throw new Error("Google Places returned no details.");
        website = details.websiteUri ?? null;
        if (website && isThirdPartyListingUrl(website)) website = null;
        googleFormattedAddress = details.formattedAddress ?? null;
      }
      const domain = website ? new URL(website).hostname : "";
      await database
        .update(investigations)
        .set({
          status: "checking_public_sources",
          stageDetail: "Checking official public sources.",
          updatedAt: new Date(),
        })
        .where(eq(investigations.id, investigationId));
      await database
        .update(branches)
        .set({
          researchStatus: "checking_public_sources",
          updatedAt: new Date(),
        })
        .where(eq(branches.id, branch.id));
      const fetcher = dependencies.fetcher ?? new SSRFSafeFetcher();
      const registryRows = await database
        .select({
          id: certifiers.id,
          name: certifiers.name,
          registryUrl: certifiers.registryUrl,
        })
        .from(certifiers)
        .where(isNotNull(certifiers.registryUrl));
      const allowedDomains = [
        ...(domain ? [domain] : []),
        ...registryRows.flatMap((row) =>
          row.registryUrl ? [new URL(row.registryUrl).hostname] : [],
        ),
      ];
      const pages: Array<{
        url: string;
        title: string;
        text: string;
        registry?: { id: string; name: string };
      }> = [];
      let fetchesUsed = 0;
      const updateFetchDetail = async (error: unknown) => {
        await database
          .update(investigations)
          .set({
            stageDetail: `Website fetch failed: ${sanitizeMessage(error)}. Continuing with outreach.`,
            updatedAt: new Date(),
          })
          .where(eq(investigations.id, investigationId));
      };
      for (const registry of registryRows) {
        if (!registry.registryUrl || fetchesUsed >= 8) continue;
        fetchesUsed++;
        try {
          const page = await fetcher.fetch(
            registry.registryUrl,
            allowedDomains,
          );
          pages.push({
            url: page.url,
            title: page.title,
            text: page.text,
            registry: { id: registry.id, name: registry.name },
          });
        } catch (error) {
          console.warn(
            `Skipping certifier registry: ${sanitizeMessage(error)}`,
          );
        }
      }
      if (website && fetchesUsed < 8) {
        fetchesUsed++;
        try {
          const first = await fetcher.fetch(website, allowedDomains);
          pages.push({ url: first.url, title: first.title, text: first.text });
          const fetchedWebsiteUrls = [website, first.url];
          const html = Buffer.from(first.bytes).toString("utf8");
          const linked = selectSameSiteLinks(
            html,
            first.url,
            fetchedWebsiteUrls,
          );
          for (const linkedUrl of linked) {
            if (fetchesUsed >= 8) break;
            if (
              isSiteUrlAlreadyFetched(linkedUrl, fetchedWebsiteUrls)
            )
              continue;
            fetchesUsed++;
            fetchedWebsiteUrls.push(linkedUrl.toString());
            try {
              const page = await fetcher.fetch(
                linkedUrl.toString(),
                allowedDomains,
              );
              pages.push({ url: page.url, title: page.title, text: page.text });
              fetchedWebsiteUrls.push(page.url);
            } catch (error) {
              console.warn(
                `Skipping linked public source: ${sanitizeMessage(error)}`,
              );
            }
          }
        } catch (error) {
          await updateFetchDetail(error);
        }
      } else if (website) {
        await updateFetchDetail(
          new Error(
            "Public research fetch budget exhausted before website fetch.",
          ),
        );
      }
      const provider = dependencies.aiProvider ?? getAIProvider();
      const websitePages = pages.filter((page) => !page.registry);
      const extracted = websitePages.length
        ? await provider.extractPublicClaims(websitePages)
        : [];
      for (const page of pages) {
        const rawText = page.text;
        const emails = [
          ...new Set(
            rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [],
          ),
        ];
        const sourceContentHash = createHash("sha256")
          .update(rawText)
          .digest("hex");
        const publicExcerpt = redactExcerpt(rawText.slice(0, 1200));
        const sourceKey = `public-research:${investigationId}:${sourceContentHash}`;
        const [source] = await database
          .insert(sources)
          .values({
            investigationId,
            branchId: branch.id,
            kind: page.registry ? "certifier_registry" : "official_website",
            url: page.url,
            title: page.title,
            retrievedAt: new Date(),
            contentHash: sourceContentHash,
            rawText,
            isPublic: true,
            publicExcerpt,
            idempotencyKey: sourceKey,
          })
          .onConflictDoNothing()
          .returning({ id: sources.id });
        const sourceId =
          source?.id ??
          (
            await database
              .select({ id: sources.id })
              .from(sources)
              .where(eq(sources.idempotencyKey, sourceKey))
              .limit(1)
          )[0]?.id;
        for (const claim of extracted.filter((item) =>
          isExcerptInText(item.excerpt, page.text),
        )) {
          await database
            .insert(claims)
            .values({
              branchId: branch.id,
              investigationId,
              product: claim.product,
              attribute: claim.attribute,
              value: claim.value,
              valueEnum: claim.valueEnum,
              evidenceCategory: claim.evidenceCategory,
              status: "proposed",
              confirmedAt: claim.confirmedAt,
              sourceId,
              supportingExcerpt: claim.excerpt,
              idempotencyKey: `public-claim:${investigationId}:${sourceContentHash}:${claim.product}:${claim.attribute}:${claim.value}`,
            })
            .onConflictDoNothing();
        }
        if (page.registry) {
          const suppliers = extracted
            .filter((claim) => claim.attribute === "supplier")
            .map((claim) => claim.value);
          for (const entry of parseRegistryEntries(
            page.text,
            branch.businessName,
            branch.name,
            suppliers,
          )) {
            const products = entry.products
              .split(",")
              .map((product) => product.trim().toLowerCase())
              .filter(Boolean);
            if (entry.supplier) {
              for (const product of products) {
                await database
                  .insert(claims)
                  .values({
                    branchId: branch.id,
                    investigationId,
                    product: product === "chicken" ? "chicken" : "general",
                    attribute: "supplier",
                    value: entry.supplier,
                    evidenceCategory: "supplier_statement",
                    status: "proposed",
                    sourceId,
                    supportingExcerpt: entry.raw,
                    idempotencyKey: `registry-claim:${investigationId}:${page.registry.id}:${entry.certificateNumber}:${product}:supplier`,
                  })
                  .onConflictDoNothing();
              }
            }
            if (entry.slaughterMethod) {
              await database
                .insert(claims)
                .values({
                  branchId: branch.id,
                  investigationId,
                  product: products.includes("chicken") ? "chicken" : "general",
                  attribute: "slaughter_method",
                  value: entry.slaughterMethod,
                  valueEnum: entry.slaughterMethod.toLowerCase(),
                  evidenceCategory: "certification",
                  status: "proposed",
                  sourceId,
                  supportingExcerpt: entry.raw,
                  idempotencyKey: `registry-claim:${investigationId}:${page.registry.id}:${entry.certificateNumber}:slaughter`,
                })
                .onConflictDoNothing();
            }
            const [existingCertificate] = await database
              .select({ id: certificates.id })
              .from(certificates)
              .where(
                eq(certificates.certificateNumber, entry.certificateNumber),
              )
              .limit(1);
            if (!existingCertificate) {
              await database.insert(certificates).values({
                branchId: branch.id,
                businessId: null,
                certifierId: page.registry.id,
                products,
                scopeText: entry.raw,
                certificateNumber: entry.certificateNumber,
                validFrom: entry.validFrom,
                validUntil: entry.validUntil,
                coversBranch: entry.coversBranch,
                sourceId,
                reviewStatus: "pending",
              });
            }
          }
        }
        for (const classification of classifyBusinessEmails(emails, domain)) {
          await database
            .insert(contactEndpoints)
            .values({
              branchId: branch.id,
              kind: "email",
              value: classification.email,
              status: classification.status,
              sourceId,
              isPersonal: classification.isPersonal,
              notes: classification.notes,
            })
            .onConflictDoNothing();
        }
      }
      let hasUsableBusinessEmail = false;
      if (branch.detailsSource === "provider") {
        const [usableEndpoint] = await database
          .select({ id: contactEndpoints.id })
          .from(contactEndpoints)
          .where(
            and(
              eq(contactEndpoints.branchId, branch.id),
              eq(contactEndpoints.kind, "email"),
              inArray(contactEndpoints.status, ["unverified", "approved"]),
              eq(contactEndpoints.isPersonal, false),
            ),
          )
          .limit(1);
        hasUsableBusinessEmail = Boolean(usableEndpoint);
      }
      const shouldExtractBusinessDetails =
        branch.detailsSource === "provider" &&
        websitePages.length > 0 &&
        hasUsableBusinessEmail;
      const extractedBusinessDetails =
        shouldExtractBusinessDetails
          ? await provider.extractBusinessDetails(websitePages)
          : null;
      await database
        .update(investigations)
        .set({
          budgetFetchesUsed: fetchesUsed,
          budgetAiCallsUsed: websitePages.length
            ? 1 + Number(shouldExtractBusinessDetails)
            : 0,
          updatedAt: new Date(),
        })
        .where(eq(investigations.id, investigationId));
      if (
        branch.detailsSource === "provider" &&
        (!website || !hasUsableBusinessEmail)
      ) {
        await database
          .update(investigations)
          .set({
            status: "reviewing_evidence",
            stageDetail: "No usable business contact found.",
            updatedAt: new Date(),
          })
          .where(eq(investigations.id, investigationId));
        await database
          .update(branches)
          .set({ researchStatus: "reviewing_evidence", updatedAt: new Date() })
          .where(eq(branches.id, branch.id));
        await queue.enqueue(
          "investigation.evidence_review",
          { investigationId },
          { singletonKey: `evidence_review:${investigationId}` },
        );
        return;
      }
      const matchingLocation = extractedBusinessDetails?.locations.find(
        (location) =>
          addressesMatch(location.address, googleFormattedAddress),
      );
      if (branch.detailsSource === "provider" && website) {
        if (
          websitePages.length &&
          extractedBusinessDetails &&
          matchingLocation
        ) {
          await database.transaction(async (tx) => {
            await applyFirstPartyBusinessDetails(
              tx,
              {
                branchId: branch.id,
                name: extractedBusinessDetails.name,
                address: matchingLocation.address,
                city: matchingLocation.city,
                website: websitePages[0]!.url,
                phone: matchingLocation.phone ?? null,
                timezone:
                  process.env.OUTREACH_DEFAULT_TIMEZONE ?? "America/Toronto",
              },
              {
                actorType: "worker",
                action: "provider_business_details_auto_confirmed",
                metadata: {
                  detailsSource: "first_party",
                  method: "official_website",
                },
              },
            );
          });
        } else {
          await database
            .update(investigations)
            .set({
              stageDetail: waitingForAutomaticBusinessDetails,
              paused: true,
              updatedAt: new Date(),
            })
            .where(eq(investigations.id, investigationId));
          return;
        }
      }
      await queue.enqueue(
        "investigation.prepare_outreach",
        { investigationId },
        { singletonKey: `prepare_outreach:${investigationId}` },
      );
    },

    "investigation.prepare_outreach": async (payload) => {
      await createOutreachDraft(
        workerActor,
        requiredString(payload.investigationId, "investigationId"),
        database,
        queue,
      );
    },

    "outreach.send": async (payload) => {
      await sendOutreach(
        workerActor,
        requiredString(payload.messageId, "messageId"),
        database,
        queue,
      );
    },

    "outreach.no_response_check": async (payload) => {
      const investigationId = requiredString(
        payload.investigationId,
        "investigationId",
      );
      const [thread] = await database
        .select()
        .from(outreachThreads)
        .where(eq(outreachThreads.investigationId, investigationId))
        .limit(1);
      if (!thread || thread.status !== "open") return;
      const [inbound] = await database
        .select({ receivedAt: outreachMessages.receivedAt })
        .from(outreachMessages)
        .where(
          and(
            eq(outreachMessages.threadId, thread.id),
            eq(outreachMessages.direction, "inbound"),
          ),
        )
        .orderBy(desc(outreachMessages.sequence))
        .limit(1);
      const [latestOutbound] = await database
        .select({ sentAt: outreachMessages.sentAt })
        .from(outreachMessages)
        .where(
          and(
            eq(outreachMessages.threadId, thread.id),
            eq(outreachMessages.direction, "outbound"),
          ),
        )
        .orderBy(desc(outreachMessages.sequence))
        .limit(1);
      if (!latestOutbound?.sentAt) return;
      if (inbound?.receivedAt && inbound.receivedAt >= latestOutbound.sentAt)
        return;
      const [settings] = await database
        .select()
        .from(outreachSettings)
        .limit(1);
      if (thread.followupsSent < (settings?.maxFollowups ?? 2)) {
        await createOutreachDraft(
          workerActor,
          investigationId,
          database,
          queue,
        );
        return;
      }
      await database
        .update(investigations)
        .set({
          outcome: "no response",
          status: "reviewing_evidence",
          updatedAt: new Date(),
        })
        .where(eq(investigations.id, investigationId));
      await reviewEvidence(workerActor, investigationId, database);
    },

    "message.parse": async (payload) => {
      await parseInboundReply(
        workerActor,
        requiredString(payload.messageId, "messageId"),
        queue,
        database,
      );
    },

    "investigation.evidence_review": async (payload) => {
      await reviewEvidence(
        workerActor,
        requiredString(payload.investigationId, "investigationId"),
        database,
      );
    },

    "notify.followers": async (payload) => {
      await notifyFollowers(
        workerActor,
        requiredString(payload.revisionId, "revisionId"),
        queue,
        database,
      );
    },

    "notification.push": async (payload) => {
      const notificationId = requiredString(payload.notificationId, "notificationId");
      const [notification] = await database
        .select()
        .from(notifications)
        .where(eq(notifications.id, notificationId))
        .limit(1);
      if (!notification) return;
      const devices = await database
        .select()
        .from(pushDevices)
        .where(eq(pushDevices.userId, notification.userId));
      const provider = getPushProvider(database);
      for (const device of devices) {
        await provider.send({
          notificationId: notification.id,
          deviceId: device.id,
          platform: device.platform,
          token: device.token,
          title: notification.title,
          body: notification.body,
          data: { link: notification.link },
        });
      }
    },

    "investigations.reconcile": async () => {
      await reconcileInvestigations(workerActor, queue, database);
    },

    "refresh.scan": async () => {
      await refreshScan(workerActor, queue, database);
    },
  };
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value)
    throw new Error(`Invalid job payload: ${label}.`);
  return value;
}

function parseRegistryEntries(
  text: string,
  businessName: string,
  branchName: string,
  suppliers: string[] = [],
) {
  return [
    ...text.matchAll(
      /Registry entry\s+\d+\s*:\s*(.*?)(?=Registry entry\s+\d+\s*:|$)/gi,
    ),
  ]
    .map((match) => {
      const raw = match[1]!.trim();
      const get = (key: string) =>
        raw.match(new RegExp(`${key}:\\s*([^;]+)`, "i"))?.[1]?.trim() ?? "";
      const business = get("Business");
      const branch = get("Branch");
      if (
        !business.toLowerCase().includes(businessName.toLowerCase()) &&
        !branch.toLowerCase().includes(branchName.toLowerCase()) &&
        !suppliers.some((supplier) =>
          get("Supplier").toLowerCase().includes(supplier.toLowerCase()),
        )
      )
        return null;
      const coverage = get("Covers branch").toLowerCase();
      return {
        raw,
        supplier: get("Supplier"),
        products: get("Products"),
        slaughterMethod: get("Slaughter"),
        certificateNumber: get("Certificate number"),
        validFrom: get("Valid from") || null,
        validUntil: get("Valid until") || null,
        coversBranch:
          coverage === "yes" ? true : coverage === "no" ? false : null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> =>
      Boolean(entry && entry.certificateNumber),
    );
}

function sanitizeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .replace(
      /(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi,
      "$1=[redacted]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .slice(0, 160);
}

function redactExcerpt(value: string) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(
      /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,
      "[redacted phone]",
    );
}
