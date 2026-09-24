DROP INDEX "users_email_idx";--> statement-breakpoint
DROP INDEX "users_phone_idx";--> statement-breakpoint
DROP INDEX "users_cpf_idx";--> statement-breakpoint
DROP INDEX "users_mp_preapproval_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_idx" ON "users" USING btree ("phone") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_cpf_idx" ON "users" USING btree ("cpf") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_mp_preapproval_idx" ON "users" USING btree ("mp_preapproval_id") WHERE "users"."deleted_at" IS NULL;