-- CreateEnum
CREATE TYPE "account_role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('pending', 'active', 'banned');

-- CreateEnum
CREATE TYPE "auth_method_type" AS ENUM ('password', 'google');

-- CreateEnum
CREATE TYPE "verification_channel" AS ENUM ('telegram', 'sms');

-- CreateEnum
CREATE TYPE "verification_purpose" AS ENUM ('registration', 'reset');

-- CreateEnum
CREATE TYPE "desired_company" AS ENUM ('friends', 'casual', 'dating');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('pending', 'verified', 'rejected', 'revoked');

-- CreateEnum
CREATE TYPE "content_source" AS ENUM ('organization', 'import');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('published', 'cancelled');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('scheduled', 'cancelled');

-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('in_pool', 'paired', 'paused', 'removed', 'withdrawn', 'no_match', 'cancelled');

-- CreateEnum
CREATE TYPE "match_source" AS ENUM ('instant', 'round', 'open');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('proposed', 'accepted_a', 'accepted_b', 'mutual', 'declined', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "match_cancel_reason" AS ENUM ('event_cancelled', 'participant_banned', 'participant_withdrew');

-- CreateEnum
CREATE TYPE "exclusion_reason" AS ENUM ('declined', 'expired');

-- CreateEnum
CREATE TYPE "listing_status" AS ENUM ('active', 'removed');

-- CreateEnum
CREATE TYPE "report_target_type" AS ENUM ('account', 'listing');

-- CreateEnum
CREATE TYPE "report_case_status" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "report_resolution" AS ENUM ('banned', 'removed', 'dismissed');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('match_proposed', 'match_mutual', 'respond_soon', 'not_a_match', 'continue_matching', 'removed_from_matching', 'no_match_found', 'event_reminder', 'event_changed', 'report_received');

-- CreateEnum
CREATE TYPE "push_status" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "device_platform" AS ENUM ('ios', 'android');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "account_role" NOT NULL DEFAULT 'user',
    "contact_identifier" BYTEA NOT NULL,
    "contact_hash" BYTEA NOT NULL,
    "date_of_birth" BYTEA,
    "status" "account_status" NOT NULL DEFAULT 'pending',
    "failed_signins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "type" "auth_method_type" NOT NULL,
    "secret" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact" BYTEA NOT NULL,
    "contact_hash" BYTEA NOT NULL,
    "channel" "verification_channel" NOT NULL,
    "provider_request_id" TEXT,
    "code_hash" TEXT NOT NULL,
    "purpose" "verification_purpose" NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "account_id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "communication_format" "desired_company" NOT NULL,
    "share_phone" BOOLEAN NOT NULL DEFAULT true,
    "safety_notice_ack_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "profile_photos" (
    "profile_id" UUID NOT NULL,
    "content" BYTEA NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_photos_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "linked_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "app" TEXT NOT NULL,
    "username" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linked_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_interests" (
    "profile_id" UUID NOT NULL,
    "interest_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_interests_pkey" PRIMARY KEY ("profile_id","interest_id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "official_link" TEXT,
    "verification_status" "verification_status" NOT NULL DEFAULT 'pending',
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "source" "content_source" NOT NULL,
    "organization_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "organization_id" UUID,
    "source" "content_source" NOT NULL,
    "provider" TEXT,
    "external_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "event_status" NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skipped_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "import_run_id" UUID NOT NULL,
    "raw" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skipped_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "desired_company" "desired_company" NOT NULL,
    "open_to_extend" BOOLEAN NOT NULL,
    "status" "application_status" NOT NULL DEFAULT 'in_pool',
    "no_response_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_a_id" UUID NOT NULL,
    "application_b_id" UUID NOT NULL,
    "source" "match_source" NOT NULL,
    "score" DECIMAL(4,3) NOT NULL,
    "seed" BIGINT NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'proposed',
    "cancel_reason" "match_cancel_reason",
    "valid_until" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exclusions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "excluded_user_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "reason" "exclusion_reason" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "author_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "event_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "listing_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" "report_target_type" NOT NULL,
    "target_account_id" UUID,
    "target_listing_id" UUID,
    "status" "report_case_status" NOT NULL DEFAULT 'open',
    "resolution" "report_resolution",
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "result" TEXT NOT NULL,
    "ip_address" INET,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "push_status" "push_status" NOT NULL DEFAULT 'pending',
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "refresh_token_id" UUID NOT NULL,
    "push_token" TEXT NOT NULL,
    "platform" "device_platform" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_contact_hash_key" ON "accounts"("contact_hash");

-- CreateIndex
CREATE UNIQUE INDEX "linked_accounts_profile_id_app_key" ON "linked_accounts"("profile_id", "app");

-- CreateIndex
CREATE UNIQUE INDEX "interests_name_key" ON "interests"("name");

-- CreateIndex
CREATE UNIQUE INDEX "events_provider_external_id_key" ON "events"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_sessions_event_id_starts_at_key" ON "event_sessions"("event_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "exclusions_match_id_key" ON "exclusions"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_refresh_token_id_key" ON "device_tokens"("refresh_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_push_token_key" ON "device_tokens"("push_token");

-- AddForeignKey
ALTER TABLE "auth_methods" ADD CONSTRAINT "auth_methods_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linked_accounts" ADD CONSTRAINT "linked_accounts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_sessions" ADD CONSTRAINT "event_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skipped_records" ADD CONSTRAINT "skipped_records_import_run_id_fkey" FOREIGN KEY ("import_run_id") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "event_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_application_a_id_fkey" FOREIGN KEY ("application_a_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_application_b_id_fkey" FOREIGN KEY ("application_b_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusions" ADD CONSTRAINT "exclusions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusions" ADD CONSTRAINT "exclusions_excluded_user_id_fkey" FOREIGN KEY ("excluded_user_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusions" ADD CONSTRAINT "exclusions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusions" ADD CONSTRAINT "exclusions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_target_account_id_fkey" FOREIGN KEY ("target_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_target_listing_id_fkey" FOREIGN KEY ("target_listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "report_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_refresh_token_id_fkey" FOREIGN KEY ("refresh_token_id") REFERENCES "refresh_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
