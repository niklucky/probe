ALTER TABLE "environments" DROP CONSTRAINT "environments_project_id_projects_id_fk";
--> statement-breakpoint
DROP INDEX "environments_project_index";--> statement-breakpoint
DELETE FROM "environments" WHERE "product_id" IS NULL;--> statement-breakpoint
ALTER TABLE "environments" ALTER COLUMN "product_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "environments" DROP COLUMN "project_id";
