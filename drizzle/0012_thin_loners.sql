ALTER TYPE "public"."document_kind" ADD VALUE 'CNIS_EXTRACT' BEFORE 'OTHER';--> statement-breakpoint
CREATE TABLE "cnis_document_items" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"competencia" timestamp with time zone NOT NULL,
	"employer_name" text,
	"salary_amount" numeric(14, 2) NOT NULL,
	"is_selected" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_contribution_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"competencia" timestamp with time zone NOT NULL,
	"employer_name" text,
	"salary_amount" numeric(14, 2) NOT NULL,
	"source_document_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cnis_document_items" ADD CONSTRAINT "cnis_document_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_contribution_records" ADD CONSTRAINT "salary_contribution_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_contribution_records" ADD CONSTRAINT "salary_contribution_records_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cnis_document_items_document_idx" ON "cnis_document_items" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "salary_contribution_records_user_idx" ON "salary_contribution_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "salary_contribution_records_user_competencia_idx" ON "salary_contribution_records" USING btree ("user_id","competencia");