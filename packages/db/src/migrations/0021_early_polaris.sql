ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
DROP INDEX "team_invitations_team_email_unique";--> statement-breakpoint
ALTER TABLE "team_invitations" ADD COLUMN "expired_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "team_invitations_team_email_unique" ON "team_invitations" USING btree ("team_id","email") WHERE "team_invitations"."accepted_at" is null and "team_invitations"."declined_at" is null and "team_invitations"."cancelled_at" is null and "team_invitations"."expired_at" is null;