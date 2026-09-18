ALTER TYPE "public"."document_kind" ADD VALUE 'INVESTMENT_STATEMENT' BEFORE 'OTHER';--> statement-breakpoint
CREATE TABLE "investment_document_items" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "investment_type" NOT NULL,
	"invested_amount" numeric(14, 2),
	"current_amount" numeric(14, 2) NOT NULL,
	"institution" text,
	"liquidity" text,
	"matched_investment_id" text,
	"is_selected" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "bank_account_id" text;--> statement-breakpoint
ALTER TABLE "investment_document_items" ADD CONSTRAINT "investment_document_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_document_items" ADD CONSTRAINT "investment_document_items_matched_investment_id_investments_id_fk" FOREIGN KEY ("matched_investment_id") REFERENCES "public"."investments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investment_document_items_document_idx" ON "investment_document_items" USING btree ("document_id");--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investments_bank_account_idx" ON "investments" USING btree ("bank_account_id");