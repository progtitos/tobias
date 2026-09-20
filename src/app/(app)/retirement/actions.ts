"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { upsertRetirementPlan, type RetirementPlanInput } from "@/services/retirementPlan";
import { uploadCnisDocument, confirmCnisImport, clearSalaryHistory } from "@/services/cnisImport";

export async function saveRetirementPlanAction(input: RetirementPlanInput) {
  const user = await requireOnboardedUser();

  if (
    !(input.currentAge > 0) ||
    !(input.targetRetirementAge > input.currentAge) ||
    !(input.desiredMonthlyIncome > 0) ||
    !(input.monthlyContribution >= 0)
  ) {
    throw new Error("Valores inválidos para o plano de aposentadoria.");
  }

  // Campos da renda garantida (INSS) são opcionais, mas se informados
  // precisam fazer sentido — evita salvar um simulador quebrado (ex.:
  // contribuição negativa) que geraria um requiredNetWorth sem significado.
  if (input.contributionYearsToDate != null && !(input.contributionYearsToDate >= 0)) {
    throw new Error("Anos de contribuição inválidos.");
  }
  if (input.averageMonthlySalary != null && !(input.averageMonthlySalary >= 0)) {
    throw new Error("Média salarial inválida.");
  }
  if (input.guaranteedMonthlyIncomeOverride != null && !(input.guaranteedMonthlyIncomeOverride >= 0)) {
    throw new Error("Renda garantida informada inválida.");
  }

  await upsertRetirementPlan(user.id, input);
  revalidatePath("/retirement");
  revalidatePath("/dashboard");
  revalidatePath("/compass");
}

export type UploadCnisState = { error?: string } | undefined;

export async function uploadCnisAction(_prev: UploadCnisState, formData: FormData): Promise<UploadCnisState> {
  const user = await requireOnboardedUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione o PDF do Extrato do CNIS (baixado no Meu INSS)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { document } = await uploadCnisDocument(user.id, {
    buffer,
    mimeType: file.type || "application/octet-stream",
    fileName: file.name,
  });

  if (document.status === "FAILED") {
    return { error: document.errorMessage ?? "Não consegui ler este arquivo." };
  }

  redirect(`/retirement/cnis/${document.id}`);
}

export type ConfirmCnisState = { error?: string } | undefined;

export async function confirmCnisImportAction(
  documentId: string,
  _prev: ConfirmCnisState,
  formData: FormData
): Promise<ConfirmCnisState> {
  const user = await requireOnboardedUser();
  const selectedIds = formData.getAll("itemId").map(String);

  if (selectedIds.length === 0) {
    return { error: "Selecione ao menos uma competência para confirmar." };
  }

  const amountByItem: Record<string, number> = {};
  for (const id of selectedIds) {
    const raw = formData.get(`amount_${id}`);
    if (typeof raw === "string" && raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) amountByItem[id] = parsed;
    }
  }

  try {
    await confirmCnisImport(user.id, documentId, selectedIds, amountByItem);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível confirmar a importação." };
  }

  revalidatePath("/retirement");
  redirect("/retirement?cnisImported=1");
}

export async function clearSalaryHistoryAction() {
  const user = await requireOnboardedUser();
  await clearSalaryHistory(user.id);
  revalidatePath("/retirement");
}
