CREATE TYPE "public"."plan_billing_cycle" AS ENUM('MENSAL', 'SEMESTRAL', 'ANUAL');--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'PENDING_PAYMENT' BEFORE 'TRIALING';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_billing_cycle" "plan_billing_cycle";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mp_preapproval_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_mp_preapproval_idx" ON "users" USING btree ("mp_preapproval_id");