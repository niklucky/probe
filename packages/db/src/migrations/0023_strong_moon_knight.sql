ALTER TABLE "automation_execution_jobs" ADD COLUMN "starting_state" varchar(32) DEFAULT 'profile_authentication' NOT NULL;--> statement-breakpoint
ALTER TABLE "browser_authoring_sessions" ADD COLUMN "starting_state" varchar(32) DEFAULT 'profile_authentication' NOT NULL;--> statement-breakpoint
ALTER TABLE "environment_profiles" ADD COLUMN "description" varchar(1000);--> statement-breakpoint
ALTER TABLE "environment_profiles" ADD COLUMN "mode" varchar(16) DEFAULT 'basic' NOT NULL;--> statement-breakpoint
ALTER TABLE "environment_profiles" ADD COLUMN "authentication_status" varchar(32) DEFAULT 'needs_verification' NOT NULL;--> statement-breakpoint
ALTER TABLE "environment_profiles" ADD COLUMN "encrypted_authentication" text;--> statement-breakpoint
ALTER TABLE "environment_profiles" ADD COLUMN "captured_at" timestamp;--> statement-breakpoint
ALTER TABLE "environment_profiles" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "test_automations" ADD COLUMN "starting_state" varchar(32) DEFAULT 'profile_authentication' NOT NULL;--> statement-breakpoint
ALTER TABLE "test_case_versions" ADD COLUMN "environment_id" integer;--> statement-breakpoint
ALTER TABLE "test_case_versions" ADD COLUMN "environment_profile_id" integer;--> statement-breakpoint
ALTER TABLE "test_case_versions" ADD COLUMN "environment_profile_name" varchar(255);--> statement-breakpoint
ALTER TABLE "test_case_versions" ADD COLUMN "environment_profile_revision" integer;--> statement-breakpoint
ALTER TABLE "test_case_versions" ADD COLUMN "starting_state" varchar(32);--> statement-breakpoint
ALTER TABLE "test_case_versions" ADD CONSTRAINT "test_case_versions_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_case_versions" ADD CONSTRAINT "test_case_versions_environment_profile_id_environment_profiles_id_fk" FOREIGN KEY ("environment_profile_id") REFERENCES "public"."environment_profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- Anonymous remains a protected, secret-free profile but is presented using
-- the QA-oriented Guest terminology.
UPDATE "environment_profiles"
SET "name" = 'Guest',
    "description" = 'Unauthenticated browser with no saved session',
    "authentication_status" = 'ready'
WHERE "is_anonymous" = true;
--> statement-breakpoint
-- Legacy binding profiles remain usable through Advanced mode. Their values
-- are already encrypted variables and exact-origin templates; profiles with no
-- authentication bindings fail closed and request reconfiguration.
UPDATE "environment_profiles" AS profile
SET "mode" = 'advanced',
    "description" = coalesce(profile."description", 'Migrated legacy authentication profile'),
    "authentication_status" = CASE
      WHEN EXISTS (
        SELECT 1 FROM "environment_profile_cookies" cookie
        WHERE cookie."profile_id" = profile."id"
      ) OR EXISTS (
        SELECT 1 FROM "environment_profile_headers" header_binding
        WHERE header_binding."profile_id" = profile."id"
      ) THEN 'ready'
      ELSE 'needs_verification'
    END
WHERE profile."is_anonymous" = false;
