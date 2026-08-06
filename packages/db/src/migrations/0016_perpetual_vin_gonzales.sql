ALTER TABLE "automation_execution_jobs" DROP CONSTRAINT "automation_execution_jobs_automation_id_test_automations_id_fk";
--> statement-breakpoint
ALTER TABLE "automation_repair_attempts" DROP CONSTRAINT "automation_repair_attempts_candidate_automation_id_test_automations_id_fk";
--> statement-breakpoint
ALTER TABLE "automation_repair_attempts" DROP CONSTRAINT "automation_repair_attempts_execution_job_id_automation_execution_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "automation_repair_sessions" DROP CONSTRAINT "automation_repair_sessions_source_execution_id_automation_execution_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "automation_repair_sessions" DROP CONSTRAINT "automation_repair_sessions_source_automation_id_test_automations_id_fk";
--> statement-breakpoint
ALTER TABLE "test_automations" DROP CONSTRAINT "test_automations_source_test_case_version_id_test_case_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "test_cases" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "automation_execution_jobs" ADD CONSTRAINT "automation_execution_jobs_automation_id_test_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."test_automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_repair_attempts" ADD CONSTRAINT "automation_repair_attempts_candidate_automation_id_test_automations_id_fk" FOREIGN KEY ("candidate_automation_id") REFERENCES "public"."test_automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_repair_attempts" ADD CONSTRAINT "automation_repair_attempts_execution_job_id_automation_execution_jobs_id_fk" FOREIGN KEY ("execution_job_id") REFERENCES "public"."automation_execution_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_repair_sessions" ADD CONSTRAINT "automation_repair_sessions_source_execution_id_automation_execution_jobs_id_fk" FOREIGN KEY ("source_execution_id") REFERENCES "public"."automation_execution_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_repair_sessions" ADD CONSTRAINT "automation_repair_sessions_source_automation_id_test_automations_id_fk" FOREIGN KEY ("source_automation_id") REFERENCES "public"."test_automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_automations" ADD CONSTRAINT "test_automations_source_test_case_version_id_test_case_versions_id_fk" FOREIGN KEY ("source_test_case_version_id") REFERENCES "public"."test_case_versions"("id") ON DELETE cascade ON UPDATE no action;