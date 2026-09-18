"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createInvestmentSchema, updateInvestmentValueSchema, investmentContributionSchema } from "@/lib/validations/investment";
import { createBankAccountSchema } from "@/lib/validations/bankAccount";
import {
  createInvestment,
  updateInvestmentValue,
  addInvestmentContribution,
  deleteInvestment,
} from "@/services/investments";
import { createBankAccount } from "@/services/bankAccounts";
import {
  uploadInvestmentStatementDocument,
  confirmInvestmentStatementImport,
} from "@/services/investmentStatementImport";

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
// Corretora — reaproveita bank_accounts com type="INVESTMENT" (decisão do
// Thiago: mais rápido de construir do que uma tabela nova só pra corretoras,
// e o extrato consolidado entra pelo mesmo fluxo de upload que já existe pra
// contas, só que criando/atualizando investimentos em vez de transações).
// ---------------------------------------------------------------------------

export async function createInvestmentAccountAction(
  _prev: InvestimentosFormState,
  formData: FormData
): Promise<InvestimentosFormState> {
  const user = await requireOnboardedUser();

  const parsed = createBankAccountSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    bankName: (formData.get("bankName") as string) || null,
    type: "INVESTMENT",
    balance: 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  await createBankAccount(user.id, parsed.data);
  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Extrato consolidado de investimentos — mesma ideia do upload de extrato de
// conta/fatura (ver conta/importActions.ts), adaptada pra posições em vez de
// transações (services/investmentStatementImport.ts).
// ---------------------------------------------------------------------------

export type UploadInvestmentStatementState = { error?: string } | undefined;

export async function uploadInvestmentStatementAction(
  _prev: UploadInvestmentStatementState,
  formData: FormData
): Promise<UploadInvestmentStatementState> {
  const user = await requireOnboardedUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo (PDF ou foto/print)." };
  }
  const bankAccountId = formData.get("bankAccountId") as string | null;
  if (!bankAccountId) return { error: "Selecione a corretora" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const { document } = await uploadInvestmentStatementDocument(
    user.id,
    { buffer, mimeType: file.type || "application/octet-stream", fileName: file.name },
    bankAccountId
  );

  if (document.status === "FAILED") {
    return { error: document.errorMessage ?? "Não consegui ler este arquivo." };
  }

  redirect(`/investimentos/importar/${document.id}`);
}

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
