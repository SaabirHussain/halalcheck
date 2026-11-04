import "dotenv/config";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, sql as postgresClient } from "./index";
import {
  branches,
  branchFollows,
  businesses,
  auditEvents,
  certificates,
  certifiers,
  claims,
  contactEndpoints,
  externalPlaceIds,
  investigationSubscriptions,
  investigations,
  notifications,
  outreachMessages,
  outreachSettings,
  outreachThreads,
  proposedUpdates,
  publishedRevisions,
  sources,
  users,
} from "./schema";
import { hashPassword } from "@/lib/auth/password";
import { demoScenarios } from "@/demo/scenarios";

function stableId(key: string) {
  const bytes = createHash("sha256")
    .update(`halalcheck:${key}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  bytes[12] = "4";
  bytes[16] = ((parseInt(bytes[16]!, 16) & 0x3) | 0x8).toString(16);
  const hex = bytes.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const ids = {
  user: (key: string) => stableId(`user:${key}`),
  business: (name: string) => stableId(`business:${name}`),
  branch: (key: string) => stableId(`branch:${key}`),
  investigation: (key: string) => stableId(`investigation:${key}`),
  source: (key: string) => stableId(`source:${key}`),
  claim: (key: string) => stableId(`claim:${key}`),
  proposal: (key: string) => stableId(`proposal:${key}`),
  revision: (key: string) => stableId(`revision:${key}`),
  thread: (key: string) => stableId(`thread:${key}`),
  message: (key: string) => stableId(`message:${key}`),
  certifier: (name: string) => stableId(`certifier:${name}`),
  certificate: (key: string) => stableId(`certificate:${key}`),
};

const scenarioByKey = new Map<string, (typeof demoScenarios)[number]>(
  demoScenarios.map((scenario) => [scenario.key, scenario] as const),
);
const adminId = ids.user("admin");
const userId = ids.user("user");
const user2Id = ids.user("user2");
const seedTime = new Date();
const daysAgo = (days: number) =>
  new Date(seedTime.getTime() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days: number) =>
  new Date(seedTime.getTime() + days * 24 * 60 * 60 * 1000);
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const defaultDate = dateOnly(daysAgo(28));

async function seedSource(
  key: string,
  branchId: string,
  investigationId: string | null,
  values: {
    kind:
      | "official_website"
      | "supplier_site"
      | "certifier_registry"
      | "email_reply";
    title: string;
    url?: string;
    rawText: string;
    publicExcerpt?: string;
    public?: boolean;
    messageId?: string;
    retrievedAt?: Date;
  },
) {
  await db
    .insert(sources)
    .values({
      id: ids.source(key),
      branchId,
      investigationId,
      kind: values.kind,
      title: values.title,
      url: values.url ?? null,
      retrievedAt: values.retrievedAt ?? daysAgo(28),
      contentHash: createHash("sha256").update(values.rawText).digest("hex"),
      rawText: values.rawText,
      isPublic: values.public ?? false,
      publicExcerpt: values.publicExcerpt ?? null,
      messageId: values.messageId,
    })
    .onConflictDoNothing();
  return ids.source(key);
}

async function seedClaim(
  key: string,
  data: {
    branchId: string;
    investigationId: string;
    proposedUpdateId?: string | null;
    product:
      | "chicken"
      | "beef"
      | "lamb"
      | "goat"
      | "turkey"
      | "other_meat"
      | "menu"
      | "kitchen"
      | "beverages"
      | "general";
    attribute:
      | "supplier"
      | "slaughter_method"
      | "stunning"
      | "certifier"
      | "certificate"
      | "menu_coverage"
      | "shared_grill"
      | "shared_fryer"
      | "shared_utensils"
      | "shared_storage"
      | "separate_preparation"
      | "alcohol_served"
      | "pork_served";
    value: string;
    valueEnum?: string | null;
    evidenceCategory:
      | "restaurant_claim"
      | "supplier_statement"
      | "documentary_evidence"
      | "certification"
      | "owner_provided"
      | "public_website";
    status: "proposed" | "published" | "superseded" | "rejected";
    sourceId: string;
    excerpt: string;
    confirmedAt?: string;
    publishedRevisionId?: string | null;
  },
) {
  await db
    .insert(claims)
    .values({
      id: ids.claim(key),
      branchId: data.branchId,
      investigationId: data.investigationId,
      proposedUpdateId: data.proposedUpdateId ?? null,
      product: data.product,
      attribute: data.attribute,
      value: data.value,
      valueEnum: data.valueEnum ?? null,
      evidenceCategory: data.evidenceCategory,
      status: data.status,
      sourceId: data.sourceId,
      supportingExcerpt: data.excerpt,
      confirmedAt: data.confirmedAt ?? defaultDate,
      publishedRevisionId: data.publishedRevisionId ?? null,
    })
    .onConflictDoNothing();
  return ids.claim(key);
}

async function seedRevision(
  key: string,
  branchId: string,
  revisionNumber: number,
  proposalId: string,
  publicSummary: string,
  snapshot: Record<string, unknown>,
  outcome: "findings_published" | "unable_to_confirm" = "findings_published",
) {
  await db
    .insert(publishedRevisions)
    .values({
      id: ids.revision(key),
      branchId,
      revisionNumber,
      proposedUpdateId: proposalId,
      publishedBy: adminId,
      publishedAt: daysAgo(
        key === "bayview-r1" ? 92 : revisionNumber > 1 ? 30 : 58,
      ),
      changeSummary:
        revisionNumber > 1
          ? "Reviewed supplier update."
          : "Initial reviewed findings.",
      publicSummary,
      snapshot,
      outcome,
    })
    .onConflictDoNothing();
  return ids.revision(key);
}

async function seedMessage(
  key: string,
  threadId: string,
  direction: "outbound" | "inbound",
  sequence: number,
  kind: "initial" | "followup" | "reply" | "bounce" | "auto_reply",
  status:
    | "draft"
    | "approved"
    | "scheduled"
    | "sending"
    | "sent"
    | "captured"
    | "failed"
    | "received"
    | "cancelled",
  subject: string,
  bodyText: string,
  questions: string[] = [],
  timing: { sentDaysAgo?: number; receivedDaysAgo?: number } = {},
) {
  const messageId = ids.message(key);
  await db
    .insert(outreachMessages)
    .values({
      id: messageId,
      threadId,
      direction,
      sequence,
      kind,
      status,
      subject,
      bodyText,
      questions,
      idempotencyKey: `demo:${key}`,
      messageIdHeader:
        direction === "outbound" ? `<${key}@demo.halalcheck.test>` : null,
      sentAt:
        direction === "outbound" && ["sent", "captured"].includes(status)
          ? daysAgo(timing.sentDaysAgo ?? 27)
          : null,
      receivedAt:
        direction === "inbound" ? daysAgo(timing.receivedDaysAgo ?? 26) : null,
    })
    .onConflictDoNothing();
  return messageId;
}

export async function seedDemo() {
  if (process.env.DEMO_MODE !== "true") {
    throw new Error("Demo seed refuses to run unless DEMO_MODE=true.");
  }
  const demoUsers = [
    {
      id: adminId,
      email: "admin@demo.halalcheck.test",
      password: "DemoAdmin!2026",
      name: "Demo Administrator",
      role: "admin" as const,
    },
    {
      id: userId,
      email: "user@demo.halalcheck.test",
      password: "DemoUser!2026",
      name: "Demo Member",
      role: "user" as const,
    },
    {
      id: user2Id,
      email: "user2@demo.halalcheck.test",
      password: "DemoUser!2026",
      name: "Demo Member Two",
      role: "user" as const,
    },
  ];
  for (const user of demoUsers) {
    await db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        passwordHash: await hashPassword(user.password),
        displayName: user.name,
        role: user.role,
      })
      .onConflictDoNothing();
  }

  const certifierDefinitions = [
    {
      name: "Demo Halal Certification Council",
      website: "https://dhcc.demo.halalcheck.test",
      registryUrl: "https://dhcc.demo.halalcheck.test/registry/",
    },
    {
      name: "Community Food Assurance Board",
      website: "https://cfab.demo.halalcheck.test",
      registryUrl: "https://cfab.demo.halalcheck.test/registry/",
    },
  ];
  for (const certifier of certifierDefinitions) {
    await db
      .insert(certifiers)
      .values({ id: ids.certifier(certifier.name), ...certifier, isDemo: true })
      .onConflictDoNothing();
  }

  const businessIds = new Map<string, string>();
  for (const scenario of demoScenarios) {
    const businessId = ids.business(scenario.business);
    businessIds.set(scenario.business, businessId);
    const website =
      scenario.key === "cedar"
        ? "https://cedar.demo.halalcheck.test/"
        : scenario.key === "olive"
          ? "https://olive.demo.halalcheck.test/"
          : scenario.key === "kebab"
            ? "https://kebab.demo.halalcheck.test/"
            : null;
    await db
      .insert(businesses)
      .values({
        id: businessId,
        name: scenario.business,
        category: scenario.category,
        cuisine: scenario.cuisine,
        website,
        isDemo: true,
      })
      .onConflictDoUpdate({
        target: businesses.id,
        set: {
          cuisine: scenario.cuisine,
          website,
          isDemo: true,
          updatedAt: new Date(),
        },
      });
  }

  const branchIds = new Map<string, string>();
  for (let index = 0; index < demoScenarios.length; index++) {
    const scenario = demoScenarios[index]!;
    const branchId = ids.branch(scenario.key);
    branchIds.set(scenario.key, branchId);
    const eastOffset = (index % 5) * 0.015;
    const northOffset = Math.floor(index / 5) * 0.017;
    await db
      .insert(branches)
      .values({
        id: branchId,
        businessId: businessIds.get(scenario.business)!,
        name:
          ("branchName" in scenario ? scenario.branchName : undefined) ??
          "Demo City",
        address: scenario.address,
        city: "Demo City",
        lat: 43.65 + northOffset,
        lng: -79.38 + eastOffset,
        phone: "+1 416 555 0100",
        website:
          scenario.key === "cedar"
            ? "https://cedar.demo.halalcheck.test/"
            : scenario.key === "olive"
              ? "https://olive.demo.halalcheck.test/"
              : scenario.key === "kebab"
                ? "https://kebab.demo.halalcheck.test/"
                : null,
        imageUrl: {
          cedar: "/images/grill.svg",
          saffron: "/images/curry.svg",
          olive: "/images/grill.svg",
          harbor: "/images/burger.svg",
          "zaytoon-downtown": "/images/shawarma.svg",
          "zaytoon-eastside": "/images/shawarma.svg",
          kebab: "/images/shawarma.svg",
          alnoor: "/images/butcher.svg",
          spice: "/images/grocery.svg",
          bayview: "/images/curry.svg",
        }[scenario.key],
        timezone: "America/Toronto",
        researchStatus: scenario.status,
        lastReviewedAt: [
          "findings_published",
          "needs_refresh",
          "unable_to_confirm",
        ].includes(scenario.status)
          ? daysAgo(28)
          : null,
        lastConfirmedAt: [
          "findings_published",
          "needs_refresh",
          "unable_to_confirm",
        ].includes(scenario.status)
          ? daysAgo(28)
          : null,
        isDemo: true,
      })
      .onConflictDoUpdate({
        target: branches.id,
        set: {
          researchStatus: scenario.status,
          isDemo: true,
          address: scenario.address,
          lastReviewedAt: [
            "findings_published",
            "needs_refresh",
            "unable_to_confirm",
          ].includes(scenario.status)
            ? daysAgo(28)
            : null,
          lastConfirmedAt: [
            "findings_published",
            "needs_refresh",
            "unable_to_confirm",
          ].includes(scenario.status)
            ? daysAgo(28)
            : null,
          updatedAt: new Date(),
        },
      });
    await db
      .insert(externalPlaceIds)
      .values({
        branchId,
        provider: "demo",
        externalId: `demo:${scenario.key}`,
      })
      .onConflictDoNothing();
  }

  const investigationIds = new Map<string, string>();
  for (const scenario of demoScenarios) {
    if (scenario.key === "cedar" || scenario.key === "zaytoon-eastside")
      continue;
    const investigationId = ids.investigation(scenario.key);
    investigationIds.set(scenario.key, investigationId);
    const active = [
      "awaiting_outreach_approval",
      "awaiting_business_response",
      "reviewing_evidence",
    ].includes(scenario.status);
    await db
      .insert(investigations)
      .values({
        id: investigationId,
        branchId: branchIds.get(scenario.key)!,
        kind:
          scenario.key === "alnoor" || scenario.key === "bayview"
            ? "refresh"
            : "initial",
        status: active
          ? scenario.status
          : scenario.status === "needs_refresh"
            ? "findings_published"
            : scenario.status,
        isActive: active,
        outcome: active ? null : scenario.status,
        createdBy: userId,
        stageDetail:
          scenario.key === "saffron"
            ? "Public research completed; initial outreach draft awaits approval."
            : null,
        budgetFetchesUsed: 1,
        budgetAiCallsUsed: 1,
      })
      .onConflictDoNothing();
  }

  await db
    .insert(outreachSettings)
    .values({
      id: 1,
      mode: "manual_approval",
      paused: false,
      maxFollowups: 2,
      minDaysBetweenMessages: 3,
      maxMessagesPerBusiness30d: 4,
      noResponseDays: 7,
    })
    .onConflictDoNothing();

  const sourcesByKey: Record<string, string> = {};
  for (const scenario of demoScenarios) {
    if (scenario.key === "cedar" || scenario.key === "zaytoon-eastside")
      continue;
    const branchId = branchIds.get(scenario.key)!;
    const investigationId = investigationIds.get(scenario.key)!;
    const siteText = `${scenario.business} provides a fictional demo source for product information.`;
    sourcesByKey[`${scenario.key}:site`] = await seedSource(
      `${scenario.key}:site`,
      branchId,
      investigationId,
      {
        kind: "official_website",
        title: `${scenario.business} public information`,
        url:
          scenario.key === "olive"
            ? "https://olive.demo.halalcheck.test/"
            : `https://${scenario.key}.demo.halalcheck.test/`,
        rawText: siteText,
        publicExcerpt: siteText,
        public: true,
      },
    );
  }
  const makeReply = async (
    key: string,
    body: string,
    retrievedAt = daysAgo(26),
  ) => {
    const branchId = branchIds.get(key)!;
    const investigationId = investigationIds.get(key)!;
    sourcesByKey[`${key}:reply`] = await seedSource(
      `${key}:reply`,
      branchId,
      investigationId,
      {
        kind: "email_reply",
        title: `${scenarioByKey.get(key)!.business} email response`,
        rawText: body,
        public: false,
        retrievedAt,
      },
    );
    return sourcesByKey[`${key}:reply`]!;
  };

  const oliveReplyText =
    "Our chicken supplier is Crescent Poultry. Chicken is hand-slaughtered. Certified by Demo Halal Certification Council.";
  const oliveReply = await makeReply("olive", oliveReplyText);
  const harborReplyText =
    "Chicken is supplied by Harbor Poultry. Beef is not halal. The halal chicken is prepared on a shared grill.";
  const harborReply = await makeReply("harbor", harborReplyText);
  const zaytoonReplyText =
    "Chicken is supplied by Crescent Poultry and hand-slaughtered. Beef is supplied by Prairie Beef Co.";
  const zaytoonReply = await makeReply("zaytoon-downtown", zaytoonReplyText);
  const kebabReplyText = "Our chicken is hand-slaughtered.";
  const kebabReply = await makeReply("kebab", kebabReplyText);
  const kebabRegistry = await seedSource(
    "kebab:registry",
    branchIds.get("kebab")!,
    investigationIds.get("kebab")!,
    {
      kind: "supplier_site",
      title: "Demo supplier registry",
      url: "https://supplier.demo.halalcheck.test/records/kebab-corner",
      rawText:
        "The registry lists Kebab Corner chicken as machine-slaughtered.",
      publicExcerpt:
        "The registry lists Kebab Corner chicken as machine-slaughtered.",
      public: true,
    },
  );
  const alnoorReplyText =
    "The current certificate lists beef and lamb products for this branch.";
  const alnoorReply = await makeReply("alnoor", alnoorReplyText);
  const bayviewReplyText =
    "Reviewed supplier confirmation: chicken is supplied by Harbor Poultry.";
  const bayviewSource = await makeReply(
    "bayview",
    bayviewReplyText,
    daysAgo(30),
  );

  const acceptedCertifier = ids.certifier("Demo Halal Certification Council");
  const secondaryCertifier = ids.certifier("Community Food Assurance Board");
  const proposalIds = new Map<string, string>();
  for (const scenario of demoScenarios) {
    if (
      scenario.key === "cedar" ||
      scenario.key === "saffron" ||
      scenario.key === "zaytoon-eastside"
    )
      continue;
    const proposalId = ids.proposal(scenario.key);
    proposalIds.set(scenario.key, proposalId);
    const pending = scenario.key === "kebab";
    const summary =
      scenario.key === "spice"
        ? "We could not confirm current findings after follow-up attempts. This is not a finding that the food is non-halal."
        : `Reviewed community research for ${scenario.business}; see the evidence categories and unanswered questions below.`;
    const flags =
      scenario.key === "kebab"
        ? [
            {
              type: "contradiction",
              detail:
                "Restaurant reports hand slaughter; supplier registry says machine slaughter.",
              claimIds: [],
            },
          ]
        : scenario.key === "alnoor"
          ? [
              {
                type: "expired_certificate",
                detail: "Certificate expired and requires refresh.",
                claimIds: [],
              },
            ]
          : scenario.key === "spice"
            ? [
                {
                  type: "unanswered",
                  detail: "No business response after one follow-up.",
                  claimIds: [],
                },
              ]
            : [];
    await db
      .insert(proposedUpdates)
      .values({
        id: proposalId,
        branchId: branchIds.get(scenario.key)!,
        investigationId: investigationIds.get(scenario.key)!,
        status: pending ? "pending" : "approved",
        publicSummary: summary,
        unansweredQuestions:
          scenario.key === "spice"
            ? ["chicken_supplier", "certifier", "certificate"]
            : [],
        flags,
        reviewedBy: pending ? null : adminId,
        reviewedAt: pending ? null : daysAgo(25),
      })
      .onConflictDoNothing();
  }

  const revisionIds = new Map<string, string>();
  for (const scenario of demoScenarios) {
    if (
      ![
        "olive",
        "harbor",
        "zaytoon-downtown",
        "alnoor",
        "spice",
        "bayview",
      ].includes(scenario.key)
    )
      continue;
    const revisionCount = scenario.key === "bayview" ? 2 : 1;
    for (let revision = 1; revision <= revisionCount; revision++) {
      const key =
        scenario.key === "bayview" ? `bayview-r${revision}` : scenario.key;
      const summary =
        scenario.key === "spice"
          ? "We could not confirm current findings after follow-up attempts. This is not a finding that the food is non-halal."
          : `Reviewed evidence summary for ${scenario.business}. Reports are attributed and unanswered questions remain explicit.`;
      const revisionId = await seedRevision(
        key,
        branchIds.get(scenario.key)!,
        revision,
        proposalIds.get(scenario.key)!,
        summary,
        {
          claims: [],
          unansweredQuestions:
            scenario.key === "spice" ? ["chicken_supplier", "certifier"] : [],
        },
        scenario.key === "spice" ? "unable_to_confirm" : "findings_published",
      );
      if (revision === revisionCount) revisionIds.set(scenario.key, revisionId);
    }
  }

  await seedClaim("olive-chicken-supplier", {
    branchId: branchIds.get("olive")!,
    investigationId: investigationIds.get("olive")!,
    proposedUpdateId: proposalIds.get("olive")!,
    product: "chicken",
    attribute: "supplier",
    value: "Restaurant reports Crescent Poultry as chicken supplier.",
    evidenceCategory: "restaurant_claim",
    status: "published",
    sourceId: oliveReply,
    excerpt: "Our chicken supplier is Crescent Poultry.",
    publishedRevisionId: revisionIds.get("olive"),
  });
  await seedClaim("olive-chicken-slaughter", {
    branchId: branchIds.get("olive")!,
    investigationId: investigationIds.get("olive")!,
    proposedUpdateId: proposalIds.get("olive")!,
    product: "chicken",
    attribute: "slaughter_method",
    value: "Restaurant reports hand-slaughtered chicken.",
    valueEnum: "hand",
    evidenceCategory: "restaurant_claim",
    status: "published",
    sourceId: oliveReply,
    excerpt: "Chicken is hand-slaughtered.",
    publishedRevisionId: revisionIds.get("olive"),
  });
  await seedClaim("olive-certifier", {
    branchId: branchIds.get("olive")!,
    investigationId: investigationIds.get("olive")!,
    proposedUpdateId: proposalIds.get("olive")!,
    product: "chicken",
    attribute: "certifier",
    value: "Demo Halal Certification Council",
    evidenceCategory: "restaurant_claim",
    status: "published",
    sourceId: oliveReply,
    excerpt: "Certified by Demo Halal Certification Council.",
    publishedRevisionId: revisionIds.get("olive"),
  });

  await seedClaim("harbor-chicken", {
    branchId: branchIds.get("harbor")!,
    investigationId: investigationIds.get("harbor")!,
    proposedUpdateId: proposalIds.get("harbor")!,
    product: "chicken",
    attribute: "supplier",
    value: "Restaurant reports Harbor Poultry supplies chicken.",
    evidenceCategory: "restaurant_claim",
    status: "published",
    sourceId: harborReply,
    excerpt: "Chicken is supplied by Harbor Poultry.",
    publishedRevisionId: revisionIds.get("harbor"),
  });
  await seedClaim("harbor-menu", {
    branchId: branchIds.get("harbor")!,
    investigationId: investigationIds.get("harbor")!,
    proposedUpdateId: proposalIds.get("harbor")!,
    product: "menu",
    attribute: "menu_coverage",
    value: "Restaurant reports a partial halal menu.",
    valueEnum: "partial",
    evidenceCategory: "restaurant_claim",
    status: "published",
    sourceId: harborReply,
    excerpt: "Beef is not halal.",
    publishedRevisionId: revisionIds.get("harbor"),
  });
  await seedClaim("harbor-grill", {
    branchId: branchIds.get("harbor")!,
    investigationId: investigationIds.get("harbor")!,
    proposedUpdateId: proposalIds.get("harbor")!,
    product: "kitchen",
    attribute: "shared_grill",
    value:
      "Restaurant reports the halal chicken is prepared on a shared grill.",
    valueEnum: "yes",
    evidenceCategory: "restaurant_claim",
    status: "published",
    sourceId: harborReply,
    excerpt: "The halal chicken is prepared on a shared grill.",
    publishedRevisionId: revisionIds.get("harbor"),
  });

  for (const item of [
    {
      product: "chicken" as const,
      attribute: "supplier" as const,
      value: "Crescent Poultry Ltd.",
      category: "restaurant_claim" as const,
      excerpt: "Chicken is supplied by Crescent Poultry",
    },
    {
      product: "chicken" as const,
      attribute: "slaughter_method" as const,
      value: "Restaurant reports hand-slaughtered chicken.",
      valueEnum: "hand",
      category: "restaurant_claim" as const,
      excerpt: "hand-slaughtered",
    },
    {
      product: "chicken" as const,
      attribute: "certifier" as const,
      value: "Demo Halal Certification Council",
      category: "certification" as const,
      excerpt: "chicken products covered by Demo Halal Certification Council",
    },
    {
      product: "beef" as const,
      attribute: "supplier" as const,
      value: "Prairie Beef Co.",
      category: "restaurant_claim" as const,
      excerpt: "Beef is supplied by Prairie Beef Co.",
    },
    {
      product: "beef" as const,
      attribute: "certifier" as const,
      value: "Community Food Assurance Board",
      category: "certification" as const,
      excerpt: "beef products covered by Community Food Assurance Board",
    },
  ]) {
    await seedClaim(`zaytoon-${item.product}-${item.attribute}`, {
      branchId: branchIds.get("zaytoon-downtown")!,
      investigationId: investigationIds.get("zaytoon-downtown")!,
      proposedUpdateId: proposalIds.get("zaytoon-downtown")!,
      product: item.product,
      attribute: item.attribute,
      value: item.value,
      valueEnum: item.valueEnum ?? null,
      evidenceCategory: item.category,
      status: "published",
      sourceId: zaytoonReply,
      excerpt: item.excerpt,
      publishedRevisionId: revisionIds.get("zaytoon-downtown"),
    });
  }

  const kebabRestaurantClaim = await seedClaim("kebab-hand", {
    branchId: branchIds.get("kebab")!,
    investigationId: investigationIds.get("kebab")!,
    proposedUpdateId: proposalIds.get("kebab")!,
    product: "chicken",
    attribute: "slaughter_method",
    value: "Restaurant reports hand-slaughtered chicken.",
    valueEnum: "hand",
    evidenceCategory: "restaurant_claim",
    status: "proposed",
    sourceId: kebabReply,
    excerpt: "hand-slaughtered",
  });
  const kebabRegistryClaim = await seedClaim("kebab-machine", {
    branchId: branchIds.get("kebab")!,
    investigationId: investigationIds.get("kebab")!,
    proposedUpdateId: proposalIds.get("kebab")!,
    product: "chicken",
    attribute: "slaughter_method",
    value: "Supplier registry lists machine-slaughtered chicken.",
    valueEnum: "machine",
    evidenceCategory: "supplier_statement",
    status: "proposed",
    sourceId: kebabRegistry,
    excerpt: "machine-slaughtered",
  });
  await db
    .update(proposedUpdates)
    .set({
      flags: [
        {
          type: "contradiction",
          detail: "Restaurant and supplier registry claims disagree.",
          claimIds: [kebabRestaurantClaim, kebabRegistryClaim],
        },
      ],
    })
    .where(eq(proposedUpdates.id, proposalIds.get("kebab")!));

  const alnoorCertificateSource = await seedSource(
    "alnoor:certificate",
    branchIds.get("alnoor")!,
    investigationIds.get("alnoor")!,
    {
      kind: "certifier_registry",
      title: "Expired demo certificate record",
      url: "https://dhcc.demo.halalcheck.test/registry/al-noor-2023",
      rawText: `Demo certificate DHCC-2023-041 valid through ${dateOnly(daysAgo(90))} for listed beef and lamb products.`,
      publicExcerpt: `Certificate DHCC-2023-041 was valid through ${dateOnly(daysAgo(90))} for listed beef and lamb products.`,
      public: true,
    },
  );
  await db
    .insert(certificates)
    .values({
      id: ids.certificate("alnoor-expired"),
      branchId: branchIds.get("alnoor")!,
      certifierId: acceptedCertifier,
      products: ["beef", "lamb"],
      scopeText: "Beef and lamb products at Al-Noor Butchers, Demo City branch",
      certificateNumber: "DHCC-2023-041",
      validFrom: dateOnly(daysAgo(365)),
      validUntil: dateOnly(daysAgo(90)),
      coversBranch: true,
      sourceId: alnoorCertificateSource,
      reviewStatus: "accepted",
      reviewedBy: adminId,
    })
    .onConflictDoNothing();
  await seedClaim("alnoor-certificate-claim", {
    branchId: branchIds.get("alnoor")!,
    investigationId: investigationIds.get("alnoor")!,
    proposedUpdateId: proposalIds.get("alnoor")!,
    product: "beef",
    attribute: "certificate",
    value: `Certificate DHCC-2023-041 reviewed; expired ${dateOnly(daysAgo(90))}.`,
    evidenceCategory: "certification",
    status: "published",
    sourceId: alnoorCertificateSource,
    excerpt: `valid through ${dateOnly(daysAgo(90))}`,
    publishedRevisionId: revisionIds.get("alnoor"),
  });

  const bayviewOldReplyText = "Chicken supplier is North Shore Poultry.";
  const bayviewOldSource = await seedSource(
    "bayview:old-supplier",
    branchIds.get("bayview")!,
    investigationIds.get("bayview")!,
    {
      kind: "email_reply",
      title: "Earlier supplier response",
      rawText: bayviewOldReplyText,
      public: false,
      retrievedAt: daysAgo(95),
    },
  );
  const bayviewOldClaimId = await seedClaim("bayview-chicken-old", {
    branchId: branchIds.get("bayview")!,
    investigationId: investigationIds.get("bayview")!,
    proposedUpdateId: proposalIds.get("bayview")!,
    product: "chicken",
    attribute: "supplier",
    value: "Restaurant previously reported North Shore Poultry.",
    evidenceCategory: "restaurant_claim",
    status: "superseded",
    sourceId: bayviewOldSource,
    excerpt: bayviewOldReplyText,
    publishedRevisionId: ids.revision("bayview-r1"),
  });
  await seedClaim("bayview-chicken-current", {
    branchId: branchIds.get("bayview")!,
    investigationId: investigationIds.get("bayview")!,
    proposedUpdateId: proposalIds.get("bayview")!,
    product: "chicken",
    attribute: "supplier",
    value: "Restaurant reports Harbor Poultry as current supplier.",
    evidenceCategory: "restaurant_claim",
    status: "published",
    sourceId: bayviewSource,
    excerpt: "chicken is supplied by Harbor Poultry.",
    publishedRevisionId: revisionIds.get("bayview"),
  });
  await db
    .update(publishedRevisions)
    .set({
      snapshot: {
        claims: [
          {
            id: bayviewOldClaimId,
            product: "chicken",
            attribute: "supplier",
            value: "North Shore Poultry",
            evidenceCategory: "restaurant_claim",
            confirmedAt: dateOnly(daysAgo(92)),
            source: {
              title: "Earlier supplier response",
              retrievedAt: daysAgo(92).toISOString(),
            },
            publicExcerpt: "Chicken supplier is North Shore Poultry.",
          },
        ],
        unansweredQuestions: [],
      },
    })
    .where(eq(publishedRevisions.id, ids.revision("bayview-r1")));
  await db
    .update(publishedRevisions)
    .set({
      snapshot: {
        claims: [
          {
            product: "chicken",
            attribute: "supplier",
            value: "Harbor Poultry",
            evidenceCategory: "restaurant_claim",
            confirmedAt: defaultDate,
            source: {
              title: "Bayview Shawarma email response",
              retrievedAt: daysAgo(26).toISOString(),
            },
            publicExcerpt: "chicken is supplied by Harbor Poultry.",
          },
        ],
        unansweredQuestions: [],
      },
    })
    .where(eq(publishedRevisions.id, revisionIds.get("bayview")!));

  for (const [key, branchKey, certifierId, product, number, validityDays] of [
    [
      "zaytoon-chicken",
      "zaytoon-downtown",
      acceptedCertifier,
      ["chicken"],
      "DHCC-DEMO-004",
      270,
    ],
    [
      "zaytoon-beef",
      "zaytoon-downtown",
      secondaryCertifier,
      ["beef"],
      "CFAB-DEMO-015",
      240,
    ],
    [
      "olive-certificate",
      "olive",
      acceptedCertifier,
      ["chicken"],
      "DHCC-DEMO-OLIVE",
      240,
    ],
    [
      "harbor-certificate",
      "harbor",
      secondaryCertifier,
      ["chicken"],
      "CFAB-DEMO-HARBOR",
      270,
    ],
    [
      "bayview-certificate",
      "bayview",
      acceptedCertifier,
      ["chicken"],
      "DHCC-DEMO-BAYVIEW",
      300,
    ],
  ] as const) {
    const sourceId =
      branchKey === "zaytoon-downtown"
        ? zaytoonReply
        : sourcesByKey[`${branchKey}:reply`];
    await db
      .insert(certificates)
      .values({
        id: ids.certificate(key),
        branchId: branchIds.get(branchKey)!,
        certifierId,
        products: [...product],
        scopeText: `${product.join(", ")} coverage at Zaytoon Kitchen Downtown branch`,
        certificateNumber: number,
        validFrom: dateOnly(daysAgo(90)),
        validUntil: dateOnly(daysFromNow(validityDays)),
        coversBranch: true,
        sourceId,
        reviewStatus: "accepted",
        reviewedBy: adminId,
      })
      .onConflictDoNothing();
  }

  const createThread = async (
    key: string,
    scenarioKey: string,
    email: string,
    followupsSent: number,
    status: "open" | "closed" | "opted_out" | "refused" | "bounced" = "open",
  ) => {
    const [endpoint] = await db
      .insert(contactEndpoints)
      .values({
        id: stableId(`endpoint:${key}`),
        branchId: branchIds.get(scenarioKey)!,
        kind: "email",
        value: email,
        status: "approved",
        isPersonal: false,
        notes: "Fictional demo business address.",
      })
      .onConflictDoNothing()
      .returning({ id: contactEndpoints.id });
    const endpointId =
      endpoint?.id ??
      (
        await db
          .select({ id: contactEndpoints.id })
          .from(contactEndpoints)
          .where(eq(contactEndpoints.value, email))
          .limit(1)
      )[0]!.id;
    const threadId = ids.thread(key);
    await db
      .insert(outreachThreads)
      .values({
        id: threadId,
        investigationId: investigationIds.get(scenarioKey)!,
        branchId: branchIds.get(scenarioKey)!,
        contactEndpointId: endpointId,
        threadToken: stableId(`thread-token:${key}`),
        followupsSent,
        status,
      })
      .onConflictDoNothing();
    return threadId;
  };

  const seedReplyConversation = async (
    key: string,
    email: string,
    questions: string[],
    replies: Array<{
      sourceId: string;
      body: string;
      receivedDaysAgo?: number;
      followupSentDaysAgo?: number;
    }>,
    options: {
      threadStatus?: "open" | "closed";
      initialSentDaysAgo?: number;
    } = {},
  ) => {
    const threadId = await createThread(
      key,
      key,
      email,
      Math.max(0, replies.length - 1),
      options.threadStatus ?? "closed",
    );
    const subject = "A few questions from HalalCheck";
    await seedMessage(
      `${key}-initial`,
      threadId,
      "outbound",
      1,
      "initial",
      "sent",
      subject,
      "We are researching current product sourcing and kitchen practices for this branch. Could you share a few details?",
      questions,
      { sentDaysAgo: options.initialSentDaysAgo },
    );
    for (const [index, reply] of replies.entries()) {
      const sequence = index + 1;
      if (index > 0) {
        await seedMessage(
          `${key}-followup-${sequence}`,
          threadId,
          "outbound",
          sequence,
          "followup",
          "sent",
          "A quick follow-up",
          "Thank you for the earlier details. Could you clarify this update for the branch?",
          questions,
          { sentDaysAgo: reply.followupSentDaysAgo },
        );
      }
      const messageId = await seedMessage(
        `${key}-reply-${sequence}`,
        threadId,
        "inbound",
        sequence,
        "reply",
        "received",
        `Re: ${subject}`,
        reply.body,
        [],
        { receivedDaysAgo: reply.receivedDaysAgo },
      );
      await db
        .update(sources)
        .set({ messageId })
        .where(eq(sources.id, reply.sourceId));
    }
    return threadId;
  };

  await seedReplyConversation(
    "harbor",
    "info@harbor.demo.halalcheck.test",
    ["chicken_supplier", "beef_supplier", "shared_grill"],
    [{ sourceId: harborReply, body: harborReplyText }],
  );
  await seedReplyConversation(
    "zaytoon-downtown",
    "info@zaytoon.demo.halalcheck.test",
    ["chicken_supplier", "chicken_slaughter", "beef_supplier"],
    [{ sourceId: zaytoonReply, body: zaytoonReplyText }],
  );
  await seedReplyConversation(
    "alnoor",
    "info@alnoor.demo.halalcheck.test",
    ["certifier", "certificate"],
    [{ sourceId: alnoorReply, body: alnoorReplyText }],
  );
  await seedReplyConversation(
    "bayview",
    "info@bayview.demo.halalcheck.test",
    ["chicken_supplier"],
    [
      {
        sourceId: bayviewOldSource,
        body: bayviewOldReplyText,
        receivedDaysAgo: 95,
      },
      {
        sourceId: bayviewSource,
        body: bayviewReplyText,
        receivedDaysAgo: 32,
        followupSentDaysAgo: 35,
      },
    ],
    { initialSentDaysAgo: 97 },
  );
  const kebabThread = await seedReplyConversation(
    "kebab",
    "info@kebab.demo.halalcheck.test",
    ["chicken_slaughter", "chicken_supplier"],
    [{ sourceId: kebabReply, body: kebabReplyText }],
    { threadStatus: "open" },
  );

  const saffronThread = await createThread(
    "saffron",
    "saffron",
    "info@saffron.demo.halalcheck.test",
    0,
  );
  await seedMessage(
    "saffron-outbound",
    saffronThread,
    "outbound",
    1,
    "initial",
    "draft",
    "A few questions from HalalCheck",
    "Hello,\n\nI’m an automated research assistant on behalf of HalalCheck, a community research directory. We are reviewing Saffron House (Demo City) and would appreciate a few details:\n\n• Which supplier provides your chicken?\n• Which organization certifies the relevant products, and does coverage include this branch?\n• Can you share a current certificate or supplier documentation?\n\nYour answers may be summarized publicly with their source and date. We will not present unanswered questions as facts. You can opt out at any time by replying STOP.\n\nThank you,\nHalalCheck research team",
    ["chicken_supplier", "certifier", "certificate"],
  );
  const saffronInvestigationId = investigationIds.get("saffron")!;
  for (const followerId of [adminId, userId, user2Id]) {
    await db
      .insert(investigationSubscriptions)
      .values({
        investigationId: saffronInvestigationId,
        userId: followerId,
      })
      .onConflictDoNothing();
    await db
      .insert(branchFollows)
      .values({
        userId: followerId,
        branchId: branchIds.get("saffron")!,
      })
      .onConflictDoNothing();
  }

  const oliveThread = await createThread(
    "olive",
    "olive",
    "info@olive.demo.halalcheck.test",
    1,
    "closed",
  );
  await seedMessage(
    "olive-initial",
    oliveThread,
    "outbound",
    1,
    "initial",
    "sent",
    "A few questions from HalalCheck",
    "Could you share supplier and certification details?",
    ["chicken_supplier", "certifier"],
  );
  const oliveVague = await seedMessage(
    "olive-vague",
    oliveThread,
    "inbound",
    1,
    "reply",
    "received",
    "Re: A few questions from HalalCheck",
    "All our meat is halal.",
  );
  await seedMessage(
    "olive-followup",
    oliveThread,
    "outbound",
    2,
    "followup",
    "sent",
    "A quick clarification",
    "Could you identify the chicken supplier and certifying organization?",
    ["chicken_supplier", "certifier"],
  );
  const oliveClarification = await seedMessage(
    "olive-clarification",
    oliveThread,
    "inbound",
    2,
    "reply",
    "received",
    "Re: A quick clarification",
    oliveReplyText,
  );
  for (const [messageId, title, content] of [
    [oliveVague, "Initial vague business reply", "All our meat is halal."],
  ] as const) {
    await db
      .insert(sources)
      .values({
        id: stableId(`source:olive-message:${messageId}`),
        investigationId: investigationIds.get("olive")!,
        branchId: branchIds.get("olive")!,
        kind: "email_reply",
        title,
        retrievedAt: daysAgo(26),
        rawText: content,
        isPublic: false,
        messageId,
      })
      .onConflictDoNothing();
  }
  await db
    .update(sources)
    .set({ messageId: oliveClarification })
    .where(eq(sources.id, oliveReply));

  await db
    .insert(branchFollows)
    .values({ userId, branchId: branchIds.get("kebab")! })
    .onConflictDoNothing();
  const spiceThread = await createThread(
    "spice",
    "spice",
    "info@spice.demo.halalcheck.test",
    1,
    "closed",
  );
  await seedMessage(
    "spice-outbound-1",
    spiceThread,
    "outbound",
    1,
    "initial",
    "sent",
    "HalalCheck research questions",
    "Could you share supplier and certification information?",
    ["chicken_supplier", "certifier"],
  );
  await seedMessage(
    "spice-outbound-2",
    spiceThread,
    "outbound",
    2,
    "followup",
    "sent",
    "Following up on HalalCheck questions",
    "One brief follow-up on suppliers and certificates. Reply STOP to opt out.",
    ["chicken_supplier", "certifier"],
  );
  await db
    .update(outreachThreads)
    .set({ status: "closed", followupsSent: 1 })
    .where(eq(outreachThreads.id, spiceThread));

  for (const [scenarioKey, threadId] of [
    ["saffron", saffronThread],
    ["olive", oliveThread],
    ["kebab", kebabThread],
    ["spice", spiceThread],
  ] as const) {
    const investigationId = investigationIds.get(scenarioKey)!;
    const email =
      scenarioKey === "saffron"
        ? "info@saffron.demo.halalcheck.test"
        : scenarioKey === "olive"
          ? "info@olive.demo.halalcheck.test"
          : scenarioKey === "kebab"
            ? "info@kebab.demo.halalcheck.test"
            : "info@spice.demo.halalcheck.test";
    await db
      .insert(contactEndpoints)
      .values({
        id: stableId(`endpoint:${scenarioKey}`),
        branchId: branchIds.get(scenarioKey)!,
        kind: "email",
        value: email,
        status: "approved",
        isPersonal: false,
      })
      .onConflictDoNothing();
    await db
      .update(outreachThreads)
      .set({ updatedAt: new Date() })
      .where(eq(outreachThreads.id, threadId));
    if (scenarioKey === "saffron") {
      await db
        .insert(investigationSubscriptions)
        .values({ investigationId, userId })
        .onConflictDoNothing();
    }
  }

  const notificationPairs = [
    ["olive", userId],
    ["harbor", userId],
    ["zaytoon-downtown", user2Id],
  ] as const;
  for (const [scenarioKey, recipientId] of notificationPairs) {
    await db
      .insert(notifications)
      .values({
        id: stableId(`notification:${scenarioKey}:${recipientId}`),
        userId: recipientId,
        type: "findings_published",
        branchId: branchIds.get(scenarioKey)!,
        title: "Demo research findings published",
        body: `Reviewed fictional findings for ${scenarioByKey.get(scenarioKey)!.business}.`,
        link: `/places/${branchIds.get(scenarioKey)!}`,
        dedupeKey: `revision:${revisionIds.get(scenarioKey)}`,
      })
      .onConflictDoNothing();
  }

  const auditFixtures: Array<{
    key: string;
    actorType: "admin" | "user" | "worker";
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, string | number | boolean | null>;
    createdAt: Date;
  }> = [
    ...[...investigationIds.entries()].map(
      ([scenarioKey, investigationId]) => ({
        key: `request:${scenarioKey}`,
        actorType: "user" as const,
        actorUserId: userId,
        action: "research_requested",
        entityType: "investigation",
        entityId: investigationId,
        metadata: {
          branchId: branchIds.get(scenarioKey)!,
          joinedExisting: false,
        },
        createdAt: daysAgo(60),
      }),
    ),
    {
      key: "saffron:contact-approved",
      actorType: "admin" as const,
      actorUserId: adminId,
      action: "contact_endpoint_approved",
      entityType: "contact_endpoint",
      entityId: stableId("endpoint:saffron"),
      metadata: { status: "approved" },
      createdAt: daysAgo(11),
    },
    {
      key: "saffron:draft-created",
      actorType: "worker" as const,
      actorUserId: null,
      action: "outreach_draft_created",
      entityType: "investigation",
      entityId: saffronInvestigationId,
      metadata: { questionCount: 3 },
      createdAt: daysAgo(10),
    },
    ...[...revisionIds.entries()].map(([scenarioKey, revisionId]) => ({
      key: `published:${scenarioKey}`,
      actorType: "admin" as const,
      actorUserId: adminId,
      action: "findings_published",
      entityType: "published_revision",
      entityId: revisionId,
      metadata: {
        branchId: branchIds.get(scenarioKey)!,
        revisionNumber: scenarioKey === "bayview" ? 2 : 1,
      },
      createdAt: daysAgo(scenarioKey === "bayview" ? 30 : 25),
    })),
    {
      key: "kebab:conflict-detected",
      actorType: "worker" as const,
      actorUserId: null,
      action: "claim_conflict_detected",
      entityType: "investigation",
      entityId: investigationIds.get("kebab")!,
      metadata: { claimCount: 2 },
      createdAt: daysAgo(24),
    },
    {
      key: "spice:unable-to-confirm",
      actorType: "admin" as const,
      actorUserId: adminId,
      action: "investigation_marked_unable_to_confirm",
      entityType: "proposed_update",
      entityId: proposalIds.get("spice")!,
      metadata: { unansweredQuestionCount: 3 },
      createdAt: daysAgo(25),
    },
  ];
  for (const event of auditFixtures) {
    await db
      .insert(auditEvents)
      .values({
        id: stableId(`audit:${event.key}`),
        actorType: event.actorType,
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })
      .onConflictDoNothing();
  }

  console.info(
    "Demo data seeded idempotently (10 fictional branches, 9 scenarios).",
  );
}

if (process.argv[1]?.endsWith("seed.ts")) {
  try {
    await seedDemo();
  } finally {
    await postgresClient.end();
  }
}
