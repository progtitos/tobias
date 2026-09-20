ALTER TABLE "incomes" ADD COLUMN "deduction_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "category_id" text;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "deduction_category_id" text;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "day_of_month" integer;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "last_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "needs_confirmation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "income_source_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurring_expense_id" text;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_deduction_category_id_categories_id_fk" FOREIGN KEY ("deduction_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_income_source_id_incomes_id_fk" FOREIGN KEY ("income_source_id") REFERENCES "public"."incomes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("recurring_expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_needs_confirmation_idx" ON "transactions" USING btree ("user_id","needs_confirmation");--> statement-breakpoint
-- Categoria global nova (Pensão) — inserida direto aqui porque
-- seedGlobalCategoriesIfNeeded() só roda uma vez (não existe backfill pra
-- instalação que já tinha categorias globais, como a do Thiago). IF NOT
-- EXISTS deixa seguro rodar de novo / em outro ambiente que já tenha essa
-- categoria.
INSERT INTO "categories" ("id", "user_id", "name", "type", "icon", "is_system")
SELECT substr(md5(random()::text || clock_timestamp()::text), 1, 24), NULL, 'Pensão', 'EXPENSE', 'hand-coins', true
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" WHERE "user_id" IS NULL AND "name" = 'Pensão'
);