CREATE TABLE "environment_variables" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment_id" integer NOT NULL,
	"key" varchar(128) NOT NULL,
	"encrypted_value" text NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"description" varchar(500),
	"created_by_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "environment_variables_environment_index" ON "environment_variables" USING btree ("environment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "environment_variables_environment_key_unique" ON "environment_variables" USING btree ("environment_id","key");