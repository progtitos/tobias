CREATE TYPE "public"."behavioral_profile_confidence" AS ENUM('INITIAL', 'CONSOLIDATED');--> statement-breakpoint
CREATE TYPE "public"."behavioral_profile" AS ENUM('CAUTIOUS_GUARDIAN', 'CONFIDENT_INVESTOR', 'GOAL_BUILDER', 'LIFESTYLE_SPENDER', 'MONTHLY_SURVIVOR', 'EMERGING_ORGANIZER');--> statement-breakpoint
CREATE TABLE "behavioral_profile_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"profile" "behavioral_profile" NOT NULL,
	"confidence" "behavioral_profile_confidence" NOT NULL,
	"signals" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "stated_birth_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "stated_gender" "gender";--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "stated_contribution_years_to_date" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "stated_average_monthly_salary" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "behavioral_profile" "behavioral_profile" DEFAULT 'EMERGING_ORGANIZER' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "behavioral_profile_confidence" "behavioral_profile_confidence" DEFAULT 'INITIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "behavioral_profile_self_report" "behavioral_profile";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "behavioral_profile_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "behavioral_profile_snapshots" ADD CONSTRAINT "behavioral_profile_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "behavioral_profile_user_time_idx" ON "behavioral_profile_snapshots" USING btree ("user_id","computed_at");