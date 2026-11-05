import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const categoryEnum = pgEnum("business_category", [
  "restaurant",
  "butcher",
  "grocery",
]);
export const researchStatusEnum = pgEnum("research_status", [
  "not_researched",
  "queued",
  "checking_public_sources",
  "awaiting_outreach_approval",
  "awaiting_business_response",
  "reviewing_evidence",
  "findings_published",
  "unable_to_confirm",
  "needs_refresh",
]);
export const investigationKindEnum = pgEnum("investigation_kind", [
  "initial",
  "refresh",
]);
export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export const contactKindEnum = pgEnum("contact_kind", [
  "email",
  "phone",
  "web_form",
]);
export const contactStatusEnum = pgEnum("contact_status", [
  "unverified",
  "approved",
  "ambiguous",
  "rejected",
]);
export const suppressionKindEnum = pgEnum("suppression_kind", [
  "email",
  "domain",
]);
export const suppressionReasonEnum = pgEnum("suppression_reason", [
  "opt_out",
  "bounce",
  "refusal",
  "manual",
]);
export const outreachModeEnum = pgEnum("outreach_mode", [
  "manual_approval",
  "auto_send_approved",
]);
export const threadStatusEnum = pgEnum("thread_status", [
  "open",
  "closed",
  "opted_out",
  "refused",
  "bounced",
]);
export const messageDirectionEnum = pgEnum("message_direction", [
  "outbound",
  "inbound",
]);
export const messageKindEnum = pgEnum("message_kind", [
  "initial",
  "followup",
  "reply",
  "bounce",
  "auto_reply",
]);
export const messageStatusEnum = pgEnum("message_status", [
  "draft",
  "approved",
  "scheduled",
  "sending",
  "sent",
  "captured",
  "failed",
  "received",
  "cancelled",
]);
export const sourceKindEnum = pgEnum("source_kind", [
  "official_website",
  "supplier_site",
  "certifier_registry",
  "email_reply",
  "owner_submission",
  "correction",
  "document",
]);
export const certificateReviewEnum = pgEnum("certificate_review_status", [
  "pending",
  "accepted",
  "rejected",
]);
export const claimProductEnum = pgEnum("claim_product", [
  "chicken",
  "beef",
  "lamb",
  "goat",
  "turkey",
  "other_meat",
  "menu",
  "kitchen",
  "beverages",
  "general",
]);
export const claimAttributeEnum = pgEnum("claim_attribute", [
  "supplier",
  "slaughter_method",
  "stunning",
  "certifier",
  "certificate",
  "menu_coverage",
  "shared_grill",
  "shared_fryer",
  "shared_utensils",
  "shared_storage",
  "separate_preparation",
  "alcohol_served",
  "pork_served",
]);
export const evidenceCategoryEnum = pgEnum("evidence_category", [
  "restaurant_claim",
  "supplier_statement",
  "documentary_evidence",
  "certification",
  "owner_provided",
  "public_website",
]);
export const claimStatusEnum = pgEnum("claim_status", [
  "proposed",
  "published",
  "superseded",
  "rejected",
]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "pending",
  "approved",
  "rejected",
]);
export const revisionOutcomeEnum = pgEnum("revision_outcome", [
  "findings_published",
  "unable_to_confirm",
]);
export const correctionStatusEnum = pgEnum("correction_status", [
  "open",
  "accepted",
  "rejected",
  "converted",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "findings_published",
  "material_change",
  "investigation_unsuccessful",
  "correction_reviewed",
]);
export const pushPlatformEnum = pgEnum("push_platform", ["ios", "android"]);
export const notificationPushStatusEnum = pgEnum("notification_push_status", [
  "captured",
  "sent",
  "failed",
]);
export const auditActorEnum = pgEnum("audit_actor_type", [
  "user",
  "admin",
  "system",
  "worker",
]);
export const outboxStatusEnum = pgEnum("outbox_status", [
  "captured",
  "sent",
  "failed",
]);
export const outboxPurposeEnum = pgEnum("outbox_purpose", [
  "outreach",
  "notification",
]);
export const branchDetailsSourceEnum = pgEnum("branch_details_source", [
  "first_party",
  "provider",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: roleEnum("role").notNull().default("user"),
    emailNotifications: boolean("email_notifications").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const businesses = pgTable("businesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  category: categoryEnum("category").notNull(),
  cuisine: text("cuisine"),
  website: text("website"),
  isDemo: boolean("is_demo").notNull().default(false),
  ...timestamps,
});

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    phone: text("phone"),
    website: text("website"),
    imageUrl: text("image_url"),
    timezone: text("timezone").notNull().default("America/Toronto"),
    researchStatus: researchStatusEnum("research_status")
      .notNull()
      .default("not_researched"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    providerCachedAt: timestamp("provider_cached_at", { withTimezone: true }),
    providerName: text("provider_name"),
    providerAddress: text("provider_address"),
    detailsSource: branchDetailsSourceEnum("details_source")
      .notNull()
      .default("first_party"),
    ...timestamps,
  },
  (table) => [
    index("branches_coordinates_idx").on(table.lat, table.lng),
    index("branches_research_status_idx").on(table.researchStatus),
    index("branches_business_id_idx").on(table.businessId),
    index("branches_name_lower_idx").on(sql`lower(${table.name})`),
  ],
);

export const externalPlaceIds = pgTable(
  "external_place_ids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("external_place_ids_provider_external_unique").on(
      table.provider,
      table.externalId,
    ),
    index("external_place_ids_branch_idx").on(table.branchId),
  ],
);

export const investigations = pgTable(
  "investigations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    kind: investigationKindEnum("kind").notNull().default("initial"),
    status: researchStatusEnum("status").notNull().default("queued"),
    isActive: boolean("is_active").notNull().default(true),
    stageDetail: text("stage_detail"),
    paused: boolean("paused").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    outcome: text("outcome"),
    budgetFetchesUsed: integer("budget_fetches_used").notNull().default(0),
    budgetAiCallsUsed: integer("budget_ai_calls_used").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("investigations_active_branch_unique")
      .on(table.branchId)
      .where(sql`${table.isActive} = true`),
    index("investigations_status_active_idx").on(table.status, table.isActive),
  ],
);

export const investigationSubscriptions = pgTable(
  "investigation_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("investigation_subscriptions_inv_user_unique").on(
      table.investigationId,
      table.userId,
    ),
    index("investigation_subscriptions_user_idx").on(table.userId),
  ],
);

export const branchFollows = pgTable(
  "branch_follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("branch_follows_user_branch_unique").on(
      table.userId,
      table.branchId,
    ),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    investigationId: uuid("investigation_id").references(
      () => investigations.id,
      {
        onDelete: "set null",
      },
    ),
    jobName: text("job_name").notNull(),
    pgbossJobId: text("pgboss_job_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    singletonKey: text("singleton_key"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    status: jobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("job_runs_investigation_idx").on(table.investigationId),
    uniqueIndex("job_runs_active_singleton_unique")
      .on(table.jobName, table.singletonKey)
      .where(sql`${table.status} in ('queued', 'running')`),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    investigationId: uuid("investigation_id").references(
      () => investigations.id,
      {
        onDelete: "set null",
      },
    ),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    kind: sourceKindEnum("kind").notNull(),
    url: text("url"),
    title: text("title").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    contentHash: text("content_hash"),
    rawText: text("raw_text"),
    isPublic: boolean("is_public").notNull().default(false),
    publicExcerpt: text("public_excerpt"),
    messageId: uuid("message_id"),
    idempotencyKey: text("idempotency_key"),
    ...timestamps,
  },
  (table) => [
    index("sources_branch_public_idx").on(table.branchId, table.isPublic),
    index("sources_investigation_idx").on(table.investigationId),
    uniqueIndex("sources_idempotency_key_unique").on(table.idempotencyKey),
  ],
);

export const contactEndpoints = pgTable(
  "contact_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    kind: contactKindEnum("kind").notNull(),
    value: text("value").notNull(),
    status: contactStatusEnum("status").notNull().default("unverified"),
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    isPersonal: boolean("is_personal").notNull().default(false),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("contact_endpoints_branch_kind_value_unique").on(
      table.branchId,
      table.kind,
      sql`lower(${table.value})`,
    ),
    index("contact_endpoints_status_idx").on(table.status),
  ],
);

export const suppressions = pgTable(
  "suppressions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    valueNormalized: text("value_normalized").notNull().unique(),
    kind: suppressionKindEnum("kind").notNull(),
    reason: suppressionReasonEnum("reason").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    ...timestamps,
  },
  (table) => [index("suppressions_kind_idx").on(table.kind)],
);

export const outreachSettings = pgTable("outreach_settings", {
  id: integer("id").primaryKey().default(1),
  mode: outreachModeEnum("mode").notNull().default("manual_approval"),
  paused: boolean("paused").notNull().default(false),
  maxFollowups: integer("max_followups").notNull().default(2),
  minDaysBetweenMessages: integer("min_days_between_messages")
    .notNull()
    .default(3),
  maxMessagesPerBusiness30d: integer("max_messages_per_business_30d")
    .notNull()
    .default(4),
  noResponseDays: integer("no_response_days").notNull().default(7),
  ...timestamps,
});

export const outreachThreads = pgTable(
  "outreach_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    contactEndpointId: uuid("contact_endpoint_id").references(
      () => contactEndpoints.id,
      {
        onDelete: "set null",
      },
    ),
    threadToken: text("thread_token").notNull().unique(),
    status: threadStatusEnum("status").notNull().default("open"),
    followupsSent: integer("followups_sent").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("outreach_threads_investigation_unique").on(
      table.investigationId,
    ),
    index("outreach_threads_branch_idx").on(table.branchId),
  ],
);

export const outreachMessages = pgTable(
  "outreach_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => outreachThreads.id, { onDelete: "cascade" }),
    direction: messageDirectionEnum("direction").notNull(),
    sequence: integer("sequence").notNull(),
    kind: messageKindEnum("kind").notNull(),
    status: messageStatusEnum("status").notNull().default("draft"),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    questions: jsonb("questions").$type<string[]>().notNull().default([]),
    providerMessageId: text("provider_message_id"),
    messageIdHeader: text("message_id_header"),
    inReplyTo: text("in_reply_to"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    error: text("error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("outreach_messages_thread_direction_sequence_unique").on(
      table.threadId,
      table.direction,
      table.sequence,
    ),
    index("outreach_messages_thread_status_idx").on(
      table.threadId,
      table.status,
    ),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    payloadHash: text("payload_hash").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("webhook_events_provider_event_unique").on(
      table.provider,
      table.eventId,
    ),
  ],
);

export const unexpectedReplies = pgTable(
  "unexpected_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    reviewStatus: text("review_status").notNull().default("unmatched"),
    ...timestamps,
  },
  (table) => [
    index("unexpected_replies_review_status_idx").on(table.reviewStatus),
  ],
);

export const evidenceDocuments = pgTable(
  "evidence_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    originalFilename: text("original_filename").notNull().default("evidence"),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    redactedStorageKey: text("redacted_storage_key"),
    isPublic: boolean("is_public").notNull().default(false),
    ...timestamps,
  },
  (table) => [index("evidence_documents_source_idx").on(table.sourceId)],
);

export const certifiers = pgTable(
  "certifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    website: text("website"),
    registryUrl: text("registry_url"),
    isDemo: boolean("is_demo").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("certifiers_name_lower_unique").on(sql`lower(${table.name})`),
  ],
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    businessId: uuid("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }),
    certifierId: uuid("certifier_id")
      .notNull()
      .references(() => certifiers.id, { onDelete: "restrict" }),
    products: text("products")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeText: text("scope_text"),
    certificateNumber: text("certificate_number"),
    validFrom: date("valid_from", { mode: "string" }),
    validUntil: date("valid_until", { mode: "string" }),
    coversBranch: boolean("covers_branch"),
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    reviewStatus: certificateReviewEnum("review_status")
      .notNull()
      .default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("certificates_branch_review_idx").on(
      table.branchId,
      table.reviewStatus,
    ),
    index("certificates_valid_until_idx").on(table.validUntil),
  ],
);

export const corrections = pgTable(
  "corrections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    url: text("url"),
    isOwnerSubmission: boolean("is_owner_submission").notNull().default(false),
    evidenceDocumentId: uuid("evidence_document_id").references(
      () => evidenceDocuments.id,
      {
        onDelete: "set null",
      },
    ),
    status: correctionStatusEnum("status").notNull().default("open"),
    adminNote: text("admin_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("corrections_branch_status_idx").on(table.branchId, table.status),
  ],
);

export const proposedUpdates = pgTable(
  "proposed_updates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    investigationId: uuid("investigation_id").references(
      () => investigations.id,
      {
        onDelete: "set null",
      },
    ),
    correctionId: uuid("correction_id").references(() => corrections.id, {
      onDelete: "set null",
    }),
    status: proposalStatusEnum("status").notNull().default("pending"),
    publicSummary: text("public_summary").notNull(),
    unansweredQuestions: jsonb("unanswered_questions")
      .$type<string[]>()
      .notNull()
      .default([]),
    flags: jsonb("flags")
      .$type<Array<{ type: string; detail: string; claimIds: string[] }>>()
      .notNull()
      .default([]),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("proposed_updates_branch_status_idx").on(
      table.branchId,
      table.status,
    ),
    index("proposed_updates_investigation_idx").on(table.investigationId),
    uniqueIndex("proposed_updates_pending_investigation_unique")
      .on(table.investigationId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const publishedRevisions = pgTable(
  "published_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    proposedUpdateId: uuid("proposed_update_id").references(
      () => proposedUpdates.id,
      {
        onDelete: "set null",
      },
    ),
    publishedBy: uuid("published_by").references(() => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    changeSummary: text("change_summary").notNull(),
    publicSummary: text("public_summary").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    outcome: revisionOutcomeEnum("outcome")
      .notNull()
      .default("findings_published"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("published_revisions_branch_revision_unique").on(
      table.branchId,
      table.revisionNumber,
    ),
    index("published_revisions_branch_published_idx").on(
      table.branchId,
      table.publishedAt,
    ),
  ],
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    investigationId: uuid("investigation_id").references(
      () => investigations.id,
      {
        onDelete: "set null",
      },
    ),
    proposedUpdateId: uuid("proposed_update_id").references(
      () => proposedUpdates.id,
      {
        onDelete: "set null",
      },
    ),
    product: claimProductEnum("product").notNull(),
    attribute: claimAttributeEnum("attribute").notNull(),
    value: text("value").notNull(),
    valueEnum: text("value_enum"),
    evidenceCategory: evidenceCategoryEnum("evidence_category").notNull(),
    status: claimStatusEnum("status").notNull().default("proposed"),
    confirmedAt: date("confirmed_at", { mode: "string" }),
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    supportingExcerpt: text("supporting_excerpt"),
    publishedRevisionId: uuid("published_revision_id").references(
      () => publishedRevisions.id,
      { onDelete: "set null" },
    ),
    idempotencyKey: text("idempotency_key"),
    ...timestamps,
  },
  (table) => [
    index("claims_branch_status_idx").on(table.branchId, table.status),
    index("claims_investigation_idx").on(table.investigationId),
    index("claims_branch_product_attribute_idx").on(
      table.branchId,
      table.product,
      table.attribute,
    ),
    uniqueIndex("claims_idempotency_key_unique").on(table.idempotencyKey),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("favorites_user_branch_unique").on(
      table.userId,
      table.branchId,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    dedupeKey: text("dedupe_key").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notifications_user_dedupe_unique").on(
      table.userId,
      table.dedupeKey,
    ),
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorType: auditActorEnum("actor_type").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
    index("audit_events_created_desc_idx").on(table.createdAt.desc()),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    to: text("to").notNull(),
    from: text("from").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    headers: jsonb("headers")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    purpose: outboxPurposeEnum("purpose").notNull(),
    status: outboxStatusEnum("status").notNull().default("captured"),
    relatedMessageId: uuid("related_message_id").references(
      () => outreachMessages.id,
      {
        onDelete: "set null",
      },
    ),
    ...timestamps,
  },
  (table) => [
    index("email_outbox_related_message_idx").on(table.relatedMessageId),
  ],
);

export const notificationEmails = pgTable(
  "notification_emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    emailOutboxId: uuid("email_outbox_id")
      .notNull()
      .references(() => emailOutbox.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_emails_notification_unique").on(
      table.notificationId,
    ),
  ],
);

export const pushDevices = pgTable(
  "push_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "cascade",
    }),
    platform: pushPlatformEnum("platform").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("push_devices_user_idx").on(table.userId)],
);

export const notificationPushes = pgTable(
  "notification_pushes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => pushDevices.id, { onDelete: "cascade" }),
    status: notificationPushStatusEnum("status").notNull().default("captured"),
    providerMessageId: text("provider_message_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_pushes_notification_device_unique").on(
      table.notificationId,
      table.deviceId,
    ),
  ],
);

export const schema = {
  users,
  sessions,
  businesses,
  branches,
  externalPlaceIds,
  investigations,
  investigationSubscriptions,
  branchFollows,
  jobRuns,
  contactEndpoints,
  suppressions,
  outreachSettings,
  outreachThreads,
  outreachMessages,
  webhookEvents,
  unexpectedReplies,
  sources,
  evidenceDocuments,
  certifiers,
  certificates,
  claims,
  proposedUpdates,
  publishedRevisions,
  favorites,
  corrections,
  notifications,
  notificationEmails,
  pushDevices,
  notificationPushes,
  auditEvents,
  rateLimits,
  emailOutbox,
};
