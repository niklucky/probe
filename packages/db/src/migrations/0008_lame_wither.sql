CREATE TYPE "public"."automation_artifact_kind" AS ENUM('trace', 'screenshot', 'video', 'log');--> statement-breakpoint
CREATE TYPE "public"."automation_execution_status" AS ENUM('queued', 'claimed', 'running', 'passed', 'failed', 'timed_out', 'cancelled', 'infrastructure_error');--> statement-breakpoint
CREATE TABLE "automation_execution_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"kind" "automation_artifact_kind" NOT NULL,
	"object_name" varchar(1000) NOT NULL,
	"original_name" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_execution_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"automation_id" integer NOT NULL,
	"environment_id" integer NOT NULL,
	"status" "automation_execution_status" DEFAULT 'queued' NOT NULL,
	"requested_by_id" integer NOT NULL,
	"worker_id" varchar(255),
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"timeout_seconds" integer DEFAULT 300 NOT NULL,
	"settings" jsonb NOT NULL,
	"result_summary" jsonb,
	"error_code" varchar(100),
	"error_message" varchar(1000),
	"structured_logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cancellation_requested_at" timestamp,
	"claimed_at" timestamp,
	"started_at" timestamp,
	"heartbeat_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_execution_artifacts" ADD CONSTRAINT "automation_execution_artifacts_job_id_automation_execution_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."automation_execution_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_execution_jobs" ADD CONSTRAINT "automation_execution_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_execution_jobs" ADD CONSTRAINT "automation_execution_jobs_automation_id_test_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."test_automations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_execution_jobs" ADD CONSTRAINT "automation_execution_jobs_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_execution_jobs" ADD CONSTRAINT "automation_execution_jobs_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_execution_artifacts_job_index" ON "automation_execution_artifacts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "automation_execution_jobs_queue_index" ON "automation_execution_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "automation_execution_jobs_project_index" ON "automation_execution_jobs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "automation_execution_jobs_automation_index" ON "automation_execution_jobs" USING btree ("automation_id","created_at");
