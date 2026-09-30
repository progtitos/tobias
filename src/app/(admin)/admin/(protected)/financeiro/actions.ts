"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { togglePlanCycle, recheckPastDuePayment, type RecheckResult } from "@/services/adminFinance";
import type { BillingCycle } from "@/lib/billing/plans";

export async function togglePlanCycleAction(cycle: BillingCycle, active: boolean) {
  await requireAdmin();
  await togglePlanCycle(cycle, active);
  revalidatePath("/admin/financeiro");
  revalidatePath("/signup");
}

export async function recheckPastDuePaymentAction(userId: string): Promise<RecheckResult> {
  await requireAdmin();
  const result = await recheckPastDuePayment(userId);
  if (result.changed) {
    revalidatePath("/admin/financeiro");
    revalidatePath("/admin");
  }
  return result;
}
