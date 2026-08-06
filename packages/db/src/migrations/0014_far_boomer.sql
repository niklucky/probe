CREATE TABLE "environment_profile_cookies" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"cookie_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environment_profile_headers" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"header_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environment_profile_variables" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"variable_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environment_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_execution_jobs" ADD COLUMN "environment_profile_id" integer;--> statement-breakpoint
ALTER TABLE "automation_execution_jobs" ADD COLUMN "environment_profile_name" varchar(255);--> statement-breakpoint
ALTER TABLE "automation_execution_jobs" ADD COLUMN "environment_profile_revision" integer;--> statement-breakpoint
ALTER TABLE "test_automations" ADD COLUMN "environment_profile_id" integer;--> statement-breakpoint
ALTER TABLE "test_automations" ADD COLUMN "environment_profile_name" varchar(255);--> statement-breakpoint
ALTER TABLE "test_automations" ADD COLUMN "environment_profile_revision" integer;--> statement-breakpoint
ALTER TABLE "environment_profile_cookies" ADD CONSTRAINT "environment_profile_cookies_profile_id_environment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."environment_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_profile_cookies" ADD CONSTRAINT "environment_profile_cookies_cookie_id_environment_cookies_id_fk" FOREIGN KEY ("cookie_id") REFERENCES "public"."environment_cookies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_profile_headers" ADD CONSTRAINT "environment_profile_headers_profile_id_environment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."environment_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_profile_headers" ADD CONSTRAINT "environment_profile_headers_header_id_environment_headers_id_fk" FOREIGN KEY ("header_id") REFERENCES "public"."environment_headers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_profile_variables" ADD CONSTRAINT "environment_profile_variables_profile_id_environment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."environment_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_profile_variables" ADD CONSTRAINT "environment_profile_variables_variable_id_environment_variables_id_fk" FOREIGN KEY ("variable_id") REFERENCES "public"."environment_variables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_profiles" ADD CONSTRAINT "environment_profiles_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_profiles" ADD CONSTRAINT "environment_profiles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "environment_profile_cookies_unique" ON "environment_profile_cookies" USING btree ("profile_id","cookie_id");--> statement-breakpoint
CREATE UNIQUE INDEX "environment_profile_headers_unique" ON "environment_profile_headers" USING btree ("profile_id","header_id");--> statement-breakpoint
CREATE UNIQUE INDEX "environment_profile_variables_unique" ON "environment_profile_variables" USING btree ("profile_id","variable_id");--> statement-breakpoint
CREATE INDEX "environment_profiles_environment_index" ON "environment_profiles" USING btree ("environment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "environment_profiles_environment_name_unique" ON "environment_profiles" USING btree ("environment_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "environment_profiles_one_anonymous_unique" ON "environment_profiles" USING btree ("environment_id") WHERE "environment_profiles"."is_anonymous" = true;--> statement-breakpoint
ALTER TABLE "automation_execution_jobs" ADD CONSTRAINT "automation_execution_jobs_environment_profile_id_environment_profiles_id_fk" FOREIGN KEY ("environment_profile_id") REFERENCES "public"."environment_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_automations" ADD CONSTRAINT "test_automations_environment_profile_id_environment_profiles_id_fk" FOREIGN KEY ("environment_profile_id") REFERENCES "public"."environment_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
INSERT INTO "environment_profiles" (
	"environment_id",
	"name",
	"is_anonymous",
	"enabled",
	"revision",
	"created_by_id"
)
SELECT "id", 'Anonymous', true, true, 1, "created_by_id"
FROM "environments";
