CREATE TYPE "public"."environment_type" AS ENUM('local', 'development', 'staging', 'production', 'custom');--> statement-breakpoint
CREATE TABLE "environments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"product_id" integer,
	"name" varchar(255) NOT NULL,
	"type" "environment_type" NOT NULL,
	"base_url" varchar(2048) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
UPDATE "test_case_versions"
SET "expected_result" = ''
WHERE "expected_result" IS NULL;--> statement-breakpoint
ALTER TABLE "test_case_versions" ALTER COLUMN "expected_result" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "test_case_versions" ALTER COLUMN "expected_result" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "test_case_versions" ADD COLUMN "prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "test_case_versions"
SET "steps" = (
	SELECT COALESCE(
		jsonb_agg(
			CASE
				WHEN jsonb_typeof(step) = 'string'
					THEN jsonb_build_object('action', step #>> '{}')
				ELSE step
			END
		),
		'[]'::jsonb
	)
	FROM jsonb_array_elements("test_case_versions"."steps") AS step
);--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "environments_project_index" ON "environments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "environments_product_index" ON "environments" USING btree ("product_id");
