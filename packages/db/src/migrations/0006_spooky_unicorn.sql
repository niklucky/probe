CREATE TYPE "public"."ai_authoring_job_status" AS ENUM('running', 'completed', 'accepted', 'discarded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_authoring_operation" AS ENUM('generate', 'improve');--> statement-breakpoint
CREATE TABLE "ai_authoring_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation" "ai_authoring_operation" NOT NULL,
	"status" "ai_authoring_job_status" DEFAULT 'running' NOT NULL,
	"suite_id" integer NOT NULL,
	"test_case_id" integer,
	"connection_ref" varchar(255),
	"provider" "ai_provider",
	"model" varchar(255),
	"prompt_version" varchar(100) NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"output_snapshot" jsonb,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"error_code" varchar(100),
	"error_message" varchar(500),
	"created_by_id" integer NOT NULL,
	"accepted_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "ai_authoring_jobs" ADD CONSTRAINT "ai_authoring_jobs_suite_id_test_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."test_suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_authoring_jobs" ADD CONSTRAINT "ai_authoring_jobs_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_authoring_jobs" ADD CONSTRAINT "ai_authoring_jobs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_authoring_jobs" ADD CONSTRAINT "ai_authoring_jobs_accepted_by_id_users_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_authoring_jobs_suite_index" ON "ai_authoring_jobs" USING btree ("suite_id");--> statement-breakpoint
CREATE INDEX "ai_authoring_jobs_test_case_index" ON "ai_authoring_jobs" USING btree ("test_case_id");--> statement-breakpoint
CREATE INDEX "ai_authoring_jobs_creator_index" ON "ai_authoring_jobs" USING btree ("created_by_id","created_at");