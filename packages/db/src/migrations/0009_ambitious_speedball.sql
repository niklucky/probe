CREATE TYPE "public"."automation_repair_attempt_status" AS ENUM('generated', 'running', 'passed', 'failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."automation_repair_classification" AS ENUM('automation', 'product', 'timeout', 'infrastructure', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."automation_repair_mode" AS ENUM('review', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."automation_repair_status" AS ENUM('active', 'awaiting_review', 'running', 'succeeded', 'stopped');--> statement-breakpoint
CREATE TABLE "automation_repair_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"attempt_number" integer NOT NULL,
	"candidate_automation_id" integer NOT NULL,
	"execution_job_id" integer,
	"status" "automation_repair_attempt_status" DEFAULT 'generated' NOT NULL,
	"explanation" text NOT NULL,
	"source_diff" text NOT NULL,
	"change_fingerprint" varchar(64) NOT NULL,
	"evidence_snapshot" jsonb NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" varchar(255) NOT NULL,
	"prompt_version" varchar(100) NOT NULL,
	"latency_ms" integer NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_repair_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"source_execution_id" integer NOT NULL,
	"source_automation_id" integer NOT NULL,
	"requested_by_id" integer NOT NULL,
	"mode" "automation_repair_mode" NOT NULL,
	"classification" "automation_repair_classification" NOT NULL,
	"diagnosis" varchar(1000) NOT NULL,
	"status" "automation_repair_status" DEFAULT 'active' NOT NULL,
	"connection_ref" varchar(255),
	"max_attempts" integer NOT NULL,
	"max_total_tokens" integer NOT NULL,
	"max_duration_ms" integer NOT NULL,
	"used_tokens" integer DEFAULT 0 NOT NULL,
	"prompt_version" varchar(100) NOT NULL,
	"stop_reason" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "automation_repair_attempts" ADD CONSTRAINT "automation_repair_attempts_session_id_automation_repair_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."automation_repair_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_repair_attempts" ADD CONSTRAINT "automation_repair_attempts_candidate_automation_id_test_automations_id_fk" FOREIGN KEY ("candidate_automation_id") REFERENCES "public"."test_automations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_repair_attempts" ADD CONSTRAINT "automation_repair_attempts_execution_job_id_automation_execution_jobs_id_fk" FOREIGN KEY ("execution_job_id") REFERENCES "public"."automation_execution_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_repair_sessions" ADD CONSTRAINT "automation_repair_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_repair_sessions" ADD CONSTRAINT "automation_repair_sessions_source_execution_id_automation_execution_jobs_id_fk" FOREIGN KEY ("source_execution_id") REFERENCES "public"."automation_execution_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_repair_sessions" ADD CONSTRAINT "automation_repair_sessions_source_automation_id_test_automations_id_fk" FOREIGN KEY ("source_automation_id") REFERENCES "public"."test_automations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_repair_sessions" ADD CONSTRAINT "automation_repair_sessions_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_repair_attempts_unique_attempt" ON "automation_repair_attempts" USING btree ("session_id","attempt_number");--> statement-breakpoint
CREATE INDEX "automation_repair_attempts_fingerprint_index" ON "automation_repair_attempts" USING btree ("session_id","change_fingerprint");--> statement-breakpoint
CREATE INDEX "automation_repair_sessions_execution_index" ON "automation_repair_sessions" USING btree ("source_execution_id","created_at");--> statement-breakpoint
CREATE INDEX "automation_repair_sessions_project_index" ON "automation_repair_sessions" USING btree ("project_id","created_at");
