/**
 * Tobias is a single product sold at three billing cycles (not tiered
 * feature plans like some competitors' Basic/Pro/Premium) — pay monthly,
 * every 6 months, or yearly, with a lower effective monthly rate the longer
 * the commitment. This is the one source of truth for prices shown on the
 * landing page and (eventually) any in-app plan picker, so a price change
 * never has to be hunted down across multiple files.
 *
 * These are marketing/display prices only — there is no payment gateway
 * wired up yet, so nothing here actually charges anyone.
 */
export type BillingCycle = "MENSAL" | "SEMESTRAL" | "ANUAL";

export type PricingPlan = {
  cycle: BillingCycle;
  label: string;
  months: number;
  price: number;
  priceLabel: string;
  monthlyEquivalentLabel: string;
  billingNote: string;
  highlight?: boolean;
};

function formatBRLStatic(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MENSAL_PRICE = 29.9;
const SEMESTRAL_PRICE = 149.9;
const ANUAL_PRICE = 319.0;

export const PRICING_PLANS: PricingPlan[] = [
  {
    cycle: "MENSAL",
    label: "Mensal",
    months: 1,
    price: MENSAL_PRICE,
    priceLabel: formatBRLStatic(MENSAL_PRICE),
    monthlyEquivalentLabel: `${formatBRLStatic(MENSAL_PRICE)}/mês`,
    billingNote: "Cobrado todo mês. Cancele quando quiser.",
  },
  {
    cycle: "SEMESTRAL",
    label: "Semestral",
    months: 6,
    price: SEMESTRAL_PRICE,
    priceLabel: formatBRLStatic(SEMESTRAL_PRICE),
    monthlyEquivalentLabel: `${formatBRLStatic(SEMESTRAL_PRICE / 6)}/mês`,
    billingNote: "Cobrado a cada 6 meses.",
    highlight: true,
  },
  {
    cycle: "ANUAL",
    label: "Anual",
    months: 12,
    price: ANUAL_PRICE,
    priceLabel: formatBRLStatic(ANUAL_PRICE),
    monthlyEquivalentLabel: `${formatBRLStatic(ANUAL_PRICE / 12)}/mês`,
    billingNote: "Cobrado uma vez por ano.",
  },
];
