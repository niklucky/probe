CREATE TABLE "environment_headers" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"value_template" text NOT NULL,
	"origin" varchar(2048) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "environment_headers" ADD CONSTRAINT "environment_headers_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_headers" ADD CONSTRAINT "environment_headers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "environment_headers_environment_index" ON "environment_headers" USING btree ("environment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "environment_headers_definition_unique" ON "environment_headers" USING btree ("environment_id",lower("name"),"origin");