import "server-only";
import { AIService } from "@/lib/ai/AIService";
import { buildFinancialContextText } from "./financialContext";
import { trackEvent, logFinancialEvent } from "./analytics";

/**
 * "Posso comprar isso?" — spec's decision agent. Always grounded in the
 * user's real financial context (built fresh from the DB, never cached
 * assumptions); the AI only reasons over that context and must return a
 * structured verdict + concrete impact, never a bare yes/no.
 */
export async function checkAffordability(userId: string, purchaseDescription: string, amount: number) {
  const context = await buildFinancialContextText(userId);
  const result = await AIService.checkAffordability(context, purchaseDescription, amount);

  await trackEvent(userId, "affordability_check", { amount, recommendation: result.recommendation });
  await logFinancialEvent(userId, "affordability_check", { purchaseDescription, amount, result });

  return result;
}
