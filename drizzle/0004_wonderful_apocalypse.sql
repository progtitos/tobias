CREATE TABLE "document_items" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"merchant" text,
	"installment_number" integer,
	"installment_total" integer,
	"category_guess" text,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"is_selected" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "bank_account_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "credit_card_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_items_document_idx" ON "document_items" USING btree ("document_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_bank_account_idx" ON "documents" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "documents_credit_card_idx" ON "documents" USING btree ("credit_card_id");