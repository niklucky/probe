CREATE TABLE "environment_cookies" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"value_template" text NOT NULL,
	"domain" varchar(255),
	"path" varchar(2048) DEFAULT '/' NOT NULL,
	"http_only" boolean DEFAULT true NOT NULL,
	"secure" boolean DEFAULT true NOT NULL,
	"same_site" varchar(10) DEFAULT 'Lax' NOT NULL,
	"expires_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "environment_cookies" ADD CONSTRAINT "environment_cookies_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_cookies" ADD CONSTRAINT "environment_cookies_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "environment_cookies_environment_index" ON "environment_cookies" USING btree ("environment_id");