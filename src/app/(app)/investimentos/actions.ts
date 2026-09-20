"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createInvestmentSchema, updateInvestmentValueSchema, investmentContributionSchema } from "@/lib/validations/investment";
import {
  createInvestment,
  updateInvestmentValue,
  addInvestmentContribution,
  deleteInvestment,
} from "@/services/investments";
import { confirmInvestmentStatementImport } from "@/services/investmentStatementImport";

export type InvestimentosFormState = { error?: string; success?: boolean } | undefined;

function revalidateAll() {
  revalidatePath("/investimentos");
  // Patrimônio mostra o total investido dentro do patrimônio líquido, e um
  // aporte ligado a um objetivo pode mudar o progresso dele lá também.
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
  revalidatePath("/retirement");
  revalidatePath("/compass");
}

export async function createInvestmentAction(
  _prev: InvestimentosFormState,
  formData: FormData
): Promise<InvestimentosFormState> {
  const user = await requireOnboardedUser();

  const invested = Number(formData.get("investedAmount") ?? 0);
  const parsed = createInvestmentSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? "OTHER"),
    investedAmount: invested,
    // Se a pessoa não souber o valor atual de cara, assume-se igual ao
    // aportado — ela ajusta depois com "Atualizar valor".
    currentAmount: formData.get("currentAmount") ? Number(formData.get("currentAmount")) : invested,
    liquidity: (formData.get("liquidity") as string) || null,
    institution: (formData.get("institution") as string) || null,
    goalId: (formData.get("goalId") as string) || null,
    bankAccountId: (formData.get("bankAccountId") as string) || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  await createInvestment(user.id, parsed.data);
  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Corretora — reaproveita bank_accounts com type="INVESTMENT". A criação da
// conta/corretora e o upload do extrato consolidado NÃO ficam mais aqui:
// moraram em Investimentos como uma UI duplicada da que já existia em Conta
// (mesma ação, mesmo serviço) e Thiago pediu pra unificar num lugar só —
// "não é por lá que vai inserir a conta/banco ou corretora... e sim na tela
// contas" (2026-09-20). Ver conta/actions.ts (createBankAccountAction, que
// já aceita type="INVESTMENT" sem precisar de nada especial) e
// conta/importActions.ts (uploadInvestmentStatementAction). O que continua
// aqui é só a confirmação da importação (revisão de posições lidas do
// extrato), porque essa tela É sobre investimentos de verdade.
// ---------------------------------------------------------------------------

export type ConfirmInvestmentImportState = { error?: string } | undefined;

export async function confirmInvestmentStatementImportAction(
  documentId: string,
  _prev: ConfirmInvestmentImportState,
  formData: FormData
): Promise<ConfirmInvestmentImportState> {
  const user = await requireOnboardedUser();
  const selectedIds = formData.getAll("itemId").map(String);

  const matchByItem: Record<string, string> = {};
  for (const id of selectedIds) {
    const matchId = formData.get(`match_${id}`);
    if (typeof matchId === "string") matchByItem[id] = matchId;
  }

  const { createdCount, updatedCount } = await confirmInvestmentStatementImport(user.id, documentId, selectedIds, matchByItem);

  revalidateAll();
  redirect(`/investimentos?imported=${createdCount}&updated=${updatedCount}`);
}

export async function updateInvestmentValueAction(investmentId: string, currentAmount: number) {
  const user = await requireOnboardedUser();
  const parsed = updateInvestmentValueSchema.safeParse({ currentAmount });
  if (!parsed.success) return;
  await updateInvestmentValue(user.id, investmentId, parsed.data.currentAmount);
  revalidateAll();
}

export async function addInvestmentContributionAction(investmentId: string, amount: number) {
  const user = await requireOnboardedUser();
  const parsed = investmentContributionSchema.safeParse({ amount });
  if (!parsed.success) return;
  await addInvestmentContribution(user.id, investmentId, parsed.data.amount);
  revalidateAll();
}

export async function deleteInvestmentAction(investmentId: string) {
  const user = await requireOnboardedUser();
  await deleteInvestment(user.id, investmentId);
  revalidateAll();
}
