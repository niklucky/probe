CREATE TYPE "public"."browser_authoring_phase" AS ENUM('starting_browser', 'inspecting_page', 'exploring_manual_steps', 'generating_automation', 'validating_automation', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."browser_authoring_status" AS ENUM('queued', 'exploring', 'generating', 'validating', 'completed', 'failed', 'cancelled', 'timed_out');--> statement-breakpoint
CREATE TABLE "browser_authoring_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"test_case_id" integer NOT NULL,
	"source_test_case_version_id" integer NOT NULL,
	"environment_id" integer NOT NULL,
	"environment_profile_id" integer NOT NULL,
	"environment_profile_name" varchar(255) NOT NULL,
	"environment_profile_revision" integer NOT NULL,
	"connection_ref" varchar(255),
	"status" "browser_authoring_status" DEFAULT 'queued' NOT NULL,
	"phase" "browser_authoring_phase" DEFAULT 'starting_browser' NOT NULL,
	"prompt_version" varchar(100) NOT NULL,
	"tool_contract_version" varchar(100) NOT NULL,
	"specification" jsonb NOT NULL,
	"observations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observed_test_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_call_count" integer DEFAULT 0 NOT NULL,
	"max_tool_calls" integer DEFAULT 16 NOT NULL,
	"timeout_seconds" integer DEFAULT 600 NOT NULL,
	"provider" "ai_provider",
	"model" varchar(255),
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"latency_ms" integer,
	"generated_automation_id" integer,
	"validation_execution_id" integer,
	"validation_status" varchar(50),
	"failure_reason" varchar(1000),
	"requested_by_id" integer NOT NULL,
	"worker_id" varchar(255),
	"claimed_at" timestamp,
	"heartbeat_at" timestamp,
	"cancellation_requested_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "environments" ADD COLUMN "test_id_attribute" varchar(100) DEFAULT 'data-testid' NOT NULL;--> statement-breakpoint
ALTER TABLE "browser_authoring_sessions" ADD CONSTRAINT "browser_authoring_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_authoring_sessions" ADD CONSTRAINT "browser_authoring_sessions_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_authoring_sessions" ADD CONSTRAINT "browser_authoring_sessions_source_test_case_version_id_test_case_versions_id_fk" FOREIGN KEY ("source_test_case_version_id") REFERENCES "public"."test_case_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_authoring_sessions" ADD CONSTRAINT "browser_authoring_sessions_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_authoring_sessions" ADD CONSTRAINT "browser_authoring_sessions_environment_profile_id_environment_profiles_id_fk" FOREIGN KEY ("environment_profile_id") REFERENCES "public"."environment_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_authoring_sessions" ADD CONSTRAINT "browser_authoring_sessions_generated_automation_id_test_automations_id_fk" FOREIGN KEY ("generated_automation_id") REFERENCES "public"."test_automations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_authoring_sessions" ADD CONSTRAINT "browser_authoring_sessions_validation_execution_id_automation_execution_jobs_id_fk" FOREIGN KEY ("validation_execution_id") REFERENCES "public"."automation_execution_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_authoring_sessions" ADD CONSTRAINT "browser_authoring_sessions_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "browser_authoring_sessions_queue_index" ON "browser_authoring_sessions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "browser_authoring_sessions_case_index" ON "browser_authoring_sessions" USING btree ("test_case_id","created_at");--> statement-breakpoint
CREATE INDEX "browser_authoring_sessions_validation_index" ON "browser_authoring_sessions" USING btree ("validation_execution_id");