CREATE TABLE "billing_plan_settings" (
	"cycle" "plan_billing_cycle" PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "financial_events_type_created_idx" ON "financial_events" USING btree ("type","created_at");