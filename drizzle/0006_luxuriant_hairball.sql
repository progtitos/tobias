CREATE TYPE "public"."gender" AS ENUM('M', 'F');--> statement-breakpoint
ALTER TABLE "retirement_plans" ADD COLUMN "birth_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "retirement_plans" ADD COLUMN "gender" "gender";--> statement-breakpoint
ALTER TABLE "retirement_plans" ADD COLUMN "contribution_years_to_date" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "retirement_plans" ADD COLUMN "contribution_years_as_of_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "retirement_plans" ADD COLUMN "average_monthly_salary" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "retirement_plans" ADD COLUMN "guaranteed_monthly_income_override" numeric(14, 2);