ALTER TABLE "test_suites" RENAME COLUMN "project_id" TO "product_id";--> statement-breakpoint
ALTER TABLE "test_suites" DROP CONSTRAINT "test_suites_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;