CREATE TYPE "public"."automation_framework" AS ENUM('playwright');--> statement-breakpoint
CREATE TYPE "public"."automation_language" AS ENUM('typescript');--> statement-breakpoint
CREATE TYPE "public"."automation_status" AS ENUM('generated', 'accepted', 'discarded', 'failed');--> statement-breakpoint
CREATE TABLE "test_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_case_id" integer NOT NULL,
	"source_test_case_version_id" integer NOT NULL,
	"environment_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"framework" "automation_framework" DEFAULT 'playwright' NOT NULL,
	"language" "automation_language" DEFAULT 'typescript' NOT NULL,
	"status" "automation_status" DEFAULT 'generated' NOT NULL,
	"source" text NOT NULL,
	"connection_ref" varchar(255),
	"provider" "ai_provider",
	"model" varchar(255),
	"prompt_version" varchar(100) NOT NULL,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"validation_error" varchar(500),
	"created_by_id" integer NOT NULL,
	"accepted_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "test_automations" ADD CONSTRAINT "test_automations_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_automations" ADD CONSTRAINT "test_automations_source_test_case_version_id_test_case_versions_id_fk" FOREIGN KEY ("source_test_case_version_id") REFERENCES "public"."test_case_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_automations" ADD CONSTRAINT "test_automations_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_automations" ADD CONSTRAINT "test_automations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_automations" ADD CONSTRAINT "test_automations_accepted_by_id_users_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "test_automations_unique_version" ON "test_automations" USING btree ("test_case_id","framework","language","version_number");--> statement-breakpoint
CREATE INDEX "test_automations_case_index" ON "test_automations" USING btree ("test_case_id","created_at");--> statement-breakpoint
CREATE INDEX "test_automations_source_version_index" ON "test_automations" USING btree ("source_test_case_version_id");