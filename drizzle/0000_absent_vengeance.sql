CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'admin', 'system', 'worker');--> statement-breakpoint
CREATE TYPE "public"."business_category" AS ENUM('restaurant', 'butcher', 'grocery');--> statement-breakpoint
CREATE TYPE "public"."certificate_review_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."claim_attribute" AS ENUM('supplier', 'slaughter_method', 'stunning', 'certifier', 'certificate', 'menu_coverage', 'shared_grill', 'shared_fryer', 'shared_utensils', 'shared_storage', 'separate_preparation', 'alcohol_served', 'pork_served');--> statement-breakpoint
CREATE TYPE "public"."claim_product" AS ENUM('chicken', 'beef', 'lamb', 'goat', 'turkey', 'other_meat', 'menu', 'kitchen', 'beverages', 'general');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('proposed', 'published', 'superseded', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."contact_kind" AS ENUM('email', 'phone', 'web_form');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('unverified', 'approved', 'ambiguous', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."correction_status" AS ENUM('open', 'accepted', 'rejected', 'converted');--> statement-breakpoint
CREATE TYPE "public"."evidence_category" AS ENUM('restaurant_claim', 'supplier_statement', 'documentary_evidence', 'certification', 'owner_provided', 'public_website');--> statement-breakpoint
CREATE TYPE "public"."investigation_kind" AS ENUM('initial', 'refresh');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('initial', 'followup', 'reply', 'bounce', 'auto_reply');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('draft', 'approved', 'scheduled', 'sending', 'sent', 'captured', 'failed', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('findings_published', 'material_change', 'investigation_unsuccessful', 'correction_reviewed');--> statement-breakpoint
CREATE TYPE "public"."outbox_purpose" AS ENUM('outreach', 'notification');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('captured', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."outreach_mode" AS ENUM('manual_approval', 'auto_send_approved');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."research_status" AS ENUM('not_researched', 'queued', 'checking_public_sources', 'awaiting_outreach_approval', 'awaiting_business_response', 'reviewing_evidence', 'findings_published', 'unable_to_confirm', 'needs_refresh');--> statement-breakpoint
CREATE TYPE "public"."revision_outcome" AS ENUM('findings_published', 'unable_to_confirm');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('official_website', 'supplier_site', 'certifier_registry', 'email_reply', 'owner_submission', 'correction', 'document');--> statement-breakpoint
CREATE TYPE "public"."suppression_kind" AS ENUM('email', 'domain');--> statement-breakpoint
CREATE TYPE "public"."suppression_reason" AS ENUM('opt_out', 'bounce', 'refusal', 'manual');--> statement-breakpoint
CREATE TYPE "public"."thread_status" AS ENUM('open', 'closed', 'opted_out', 'refused', 'bounced');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_type" "audit_actor_type" NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"phone" text,
	"website" text,
	"image_url" text,
	"timezone" text DEFAULT 'America/Toronto' NOT NULL,
	"research_status" "research_status" DEFAULT 'not_researched' NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"last_confirmed_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"provider_cached_at" timestamp with time zone,
	"provider_name" text,
	"provider_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" "business_category" NOT NULL,
	"cuisine" text,
	"website" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"business_id" uuid,
	"certifier_id" uuid NOT NULL,
	"products" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope_text" text,
	"certificate_number" text,
	"valid_from" date,
	"valid_until" date,
	"covers_branch" boolean,
	"source_id" uuid,
	"review_status" "certificate_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"registry_url" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"investigation_id" uuid,
	"proposed_update_id" uuid,
	"product" "claim_product" NOT NULL,
	"attribute" "claim_attribute" NOT NULL,
	"value" text NOT NULL,
	"value_enum" text,
	"evidence_category" "evidence_category" NOT NULL,
	"status" "claim_status" DEFAULT 'proposed' NOT NULL,
	"confirmed_at" date,
	"source_id" uuid,
	"supporting_excerpt" text,
	"published_revision_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"kind" "contact_kind" NOT NULL,
	"value" text NOT NULL,
	"status" "contact_status" DEFAULT 'unverified' NOT NULL,
	"source_id" uuid,
	"is_personal" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"url" text,
	"is_owner_submission" boolean DEFAULT false NOT NULL,
	"evidence_document_id" uuid,
	"status" "correction_status" DEFAULT 'open' NOT NULL,
	"admin_note" text,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"from" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"purpose" "outbox_purpose" NOT NULL,
	"status" "outbox_status" DEFAULT 'captured' NOT NULL,
	"related_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"redacted_storage_key" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "external_place_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investigation_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"kind" "investigation_kind" DEFAULT 'initial' NOT NULL,
	"status" "research_status" DEFAULT 'queued' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"stage_detail" text,
	"paused" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"outcome" text,
	"budget_fetches_used" integer DEFAULT 0 NOT NULL,
	"budget_ai_calls_used" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid,
	"job_name" text NOT NULL,
	"pgboss_job_id" text,
	"idempotency_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_runs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "notification_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"email_outbox_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"branch_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text NOT NULL,
	"read_at" timestamp with time zone,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"sequence" integer NOT NULL,
	"kind" "message_kind" NOT NULL,
	"status" "message_status" DEFAULT 'draft' NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_message_id" text,
	"message_id_header" text,
	"in_reply_to" text,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"approved_by" uuid,
	"idempotency_key" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_messages_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "outreach_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"mode" "outreach_mode" DEFAULT 'manual_approval' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"max_followups" integer DEFAULT 2 NOT NULL,
	"min_days_between_messages" integer DEFAULT 3 NOT NULL,
	"max_messages_per_business_30d" integer DEFAULT 4 NOT NULL,
	"no_response_days" integer DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"contact_endpoint_id" uuid,
	"thread_token" text NOT NULL,
	"status" "thread_status" DEFAULT 'open' NOT NULL,
	"followups_sent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_threads_thread_token_unique" UNIQUE("thread_token")
);
--> statement-breakpoint
CREATE TABLE "proposed_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"investigation_id" uuid,
	"correction_id" uuid,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"public_summary" text NOT NULL,
	"unanswered_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"proposed_update_id" uuid,
	"published_by" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_summary" text NOT NULL,
	"public_summary" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"outcome" "revision_outcome" DEFAULT 'findings_published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid,
	"branch_id" uuid NOT NULL,
	"kind" "source_kind" NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text,
	"raw_text" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"public_excerpt" text,
	"message_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"value_normalized" text NOT NULL,
	"kind" "suppression_kind" NOT NULL,
	"reason" "suppression_reason" NOT NULL,
	"created_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppressions_value_normalized_unique" UNIQUE("value_normalized")
);
--> statement-breakpoint
CREATE TABLE "unexpected_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"review_status" text DEFAULT 'unmatched' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"email_notifications" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_hash" text NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_follows" ADD CONSTRAINT "branch_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_follows" ADD CONSTRAINT "branch_follows_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_certifier_id_certifiers_id_fk" FOREIGN KEY ("certifier_id") REFERENCES "public"."certifiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_proposed_update_id_proposed_updates_id_fk" FOREIGN KEY ("proposed_update_id") REFERENCES "public"."proposed_updates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_published_revision_id_published_revisions_id_fk" FOREIGN KEY ("published_revision_id") REFERENCES "public"."published_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_endpoints" ADD CONSTRAINT "contact_endpoints_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_endpoints" ADD CONSTRAINT "contact_endpoints_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_evidence_document_id_evidence_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."evidence_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_related_message_id_outreach_messages_id_fk" FOREIGN KEY ("related_message_id") REFERENCES "public"."outreach_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_documents" ADD CONSTRAINT "evidence_documents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_place_ids" ADD CONSTRAINT "external_place_ids_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigation_subscriptions" ADD CONSTRAINT "investigation_subscriptions_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigation_subscriptions" ADD CONSTRAINT "investigation_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_emails" ADD CONSTRAINT "notification_emails_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_emails" ADD CONSTRAINT "notification_emails_email_outbox_id_email_outbox_id_fk" FOREIGN KEY ("email_outbox_id") REFERENCES "public"."email_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_thread_id_outreach_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."outreach_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_threads" ADD CONSTRAINT "outreach_threads_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_threads" ADD CONSTRAINT "outreach_threads_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_threads" ADD CONSTRAINT "outreach_threads_contact_endpoint_id_contact_endpoints_id_fk" FOREIGN KEY ("contact_endpoint_id") REFERENCES "public"."contact_endpoints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_updates" ADD CONSTRAINT "proposed_updates_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_updates" ADD CONSTRAINT "proposed_updates_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_updates" ADD CONSTRAINT "proposed_updates_correction_id_corrections_id_fk" FOREIGN KEY ("correction_id") REFERENCES "public"."corrections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_updates" ADD CONSTRAINT "proposed_updates_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_revisions" ADD CONSTRAINT "published_revisions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_revisions" ADD CONSTRAINT "published_revisions_proposed_update_id_proposed_updates_id_fk" FOREIGN KEY ("proposed_update_id") REFERENCES "public"."proposed_updates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_revisions" ADD CONSTRAINT "published_revisions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_desc_idx" ON "audit_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "branch_follows_user_branch_unique" ON "branch_follows" USING btree ("user_id","branch_id");--> statement-breakpoint
CREATE INDEX "branches_coordinates_idx" ON "branches" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "branches_research_status_idx" ON "branches" USING btree ("research_status");--> statement-breakpoint
CREATE INDEX "branches_business_id_idx" ON "branches" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "branches_name_lower_idx" ON "branches" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "certificates_branch_review_idx" ON "certificates" USING btree ("branch_id","review_status");--> statement-breakpoint
CREATE INDEX "certificates_valid_until_idx" ON "certificates" USING btree ("valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "certifiers_name_lower_unique" ON "certifiers" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "claims_branch_status_idx" ON "claims" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "claims_investigation_idx" ON "claims" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "claims_branch_product_attribute_idx" ON "claims" USING btree ("branch_id","product","attribute");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_idempotency_key_unique" ON "claims" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_endpoints_branch_kind_value_unique" ON "contact_endpoints" USING btree ("branch_id","kind",lower("value"));--> statement-breakpoint
CREATE INDEX "contact_endpoints_status_idx" ON "contact_endpoints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "corrections_branch_status_idx" ON "corrections" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "email_outbox_related_message_idx" ON "email_outbox" USING btree ("related_message_id");--> statement-breakpoint
CREATE INDEX "evidence_documents_source_idx" ON "evidence_documents" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_place_ids_provider_external_unique" ON "external_place_ids" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "external_place_ids_branch_idx" ON "external_place_ids" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_branch_unique" ON "favorites" USING btree ("user_id","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "investigation_subscriptions_inv_user_unique" ON "investigation_subscriptions" USING btree ("investigation_id","user_id");--> statement-breakpoint
CREATE INDEX "investigation_subscriptions_user_idx" ON "investigation_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "investigations_active_branch_unique" ON "investigations" USING btree ("branch_id") WHERE "investigations"."is_active" = true;--> statement-breakpoint
CREATE INDEX "investigations_status_active_idx" ON "investigations" USING btree ("status","is_active");--> statement-breakpoint
CREATE INDEX "job_runs_investigation_idx" ON "job_runs" USING btree ("investigation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_emails_notification_unique" ON "notification_emails" USING btree ("notification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_dedupe_unique" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_messages_thread_direction_sequence_unique" ON "outreach_messages" USING btree ("thread_id","direction","sequence");--> statement-breakpoint
CREATE INDEX "outreach_messages_thread_status_idx" ON "outreach_messages" USING btree ("thread_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_threads_investigation_unique" ON "outreach_threads" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "outreach_threads_branch_idx" ON "outreach_threads" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "proposed_updates_branch_status_idx" ON "proposed_updates" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "proposed_updates_investigation_idx" ON "proposed_updates" USING btree ("investigation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposed_updates_pending_investigation_unique" ON "proposed_updates" USING btree ("investigation_id") WHERE "proposed_updates"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "published_revisions_branch_revision_unique" ON "published_revisions" USING btree ("branch_id","revision_number");--> statement-breakpoint
CREATE INDEX "published_revisions_branch_published_idx" ON "published_revisions" USING btree ("branch_id","published_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sources_branch_public_idx" ON "sources" USING btree ("branch_id","is_public");--> statement-breakpoint
CREATE INDEX "sources_investigation_idx" ON "sources" USING btree ("investigation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_idempotency_key_unique" ON "sources" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "suppressions_kind_idx" ON "suppressions" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "unexpected_replies_review_status_idx" ON "unexpected_replies" USING btree ("review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_unique" ON "webhook_events" USING btree ("provider","event_id");