ALTER TABLE "whatsapp_connections" ADD COLUMN "verification_code" text;--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD COLUMN "verification_code_expires_at" timestamp with time zone;