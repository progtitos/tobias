import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { billingPlanSettings } from "@/lib/db/schema";
import { PRICING_PLANS, type BillingCycle, type PricingPlan } from "@/lib/billing/plans";

/**
 * Sem linha em `billing_plan_settings` pra um ciclo = considerado ativo. Isso
 * evita depender de um seed rodar antes do primeiro uso, e faz com que um
 * ciclo novo adicionado em PRICING_PLANS no futuro já nasça visível por
 * padrão, sem precisar lembrar de "ativar" ele em algum lugar.
 */
export async function getPlanCycleActiveMap(): Promise<Record<BillingCycle, boolean>> {
  const rows = await db.select().from(billingPlanSettings);
  const map = { MENSAL: true, SEMESTRAL: true, ANUAL: true } as Record<BillingCycle, boolean>;
  for (const row of rows) map[row.cycle as BillingCycle] = row.active;
  return map;
}

export async function isPlanCycleActive(cycle: BillingCycle): Promise<boolean> {
  const [row] = await db.select().from(billingPlanSettings).where(eq(billingPlanSettings.cycle, cycle)).limit(1);
  return row ? row.active : true;
}

/** Liga/desliga um ciclo — usado pelo toggle da tela Admin › Financeiro. */
export async function setPlanCycleActive(cycle: BillingCycle, active: boolean) {
  await db
    .insert(billingPlanSettings)
    .values({ cycle, active, updatedAt: new Date() })
    .onConflictDoUpdate({ target: billingPlanSettings.cycle, set: { active, updatedAt: new Date() } });
}

/** Ciclos que devem aparecer no seletor de cadastro (Signup) agora. */
export async function getVisiblePricingPlans(): Promise<PricingPlan[]> {
  const map = await getPlanCycleActiveMap();
  return PRICING_PLANS.filter((p) => map[p.cycle]);
}
