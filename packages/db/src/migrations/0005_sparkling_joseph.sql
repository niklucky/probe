CREATE TYPE "public"."ai_connection_scope" AS ENUM('general', 'test-authoring', 'test-execution');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('openai', 'anthropic', 'openai-compatible');--> statement-breakpoint
CREATE TABLE "ai_connection_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer,
	"actor_user_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"endpoint" varchar(2048),
	"model" varchar(255) NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope" "ai_connection_scope" DEFAULT 'general' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"encrypted_config" text,
	"has_credentials" boolean DEFAULT false NOT NULL,
	"created_by_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_connection_audit_logs" ADD CONSTRAINT "ai_connection_audit_logs_connection_id_ai_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."ai_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_connection_audit_logs" ADD CONSTRAINT "ai_connection_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_connections" ADD CONSTRAINT "ai_connections_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_connection_audit_connection_index" ON "ai_connection_audit_logs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "ai_connections_scope_index" ON "ai_connections" USING btree ("scope","enabled","is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_connections_one_default_per_scope" ON "ai_connections" USING btree ("scope") WHERE "ai_connections"."is_default" = true;