"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { uploadStatementDocument, confirmStatementImport, type ImportTarget } from "@/services/statementImport";

export type UploadStatementState = { error?: string } | undefined;

function targetFromFormData(formData: FormData): ImportTarget {
  const bankAccountId = formData.get("bankAccountId") as string | null;
  const creditCardId = formData.get("creditCardId") as string | null;
  if (creditCardId) return { creditCardId };
  if (bankAccountId) return { bankAccountId };
  throw new Error("Selecione a conta ou o cartão");
}

export async function uploadStatementAction(
  _prev: UploadStatementState,
  formData: FormData
): Promise<UploadStatementState> {
  const user = await requireOnboardedUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo (PDF, CSV ou foto/print)." };
  }

  let target: ImportTarget;
  try {
    target = targetFromFormData(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Dados inválidos" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { document } = await uploadStatementDocument(user.id, { buffer, mimeType: file.type || "application/octet-stream", fileName: file.name }, target);

  if (document.status === "FAILED") {
    return { error: document.errorMessage ?? "Não consegui ler este arquivo." };
  }

  redirect(`/conta/importar/${document.id}`);
}

export type ConfirmImportState = { error?: string } | undefined;

export async function confirmStatementImportAction(
  documentId: string,
  _prev: ConfirmImportState,
  formData: FormData
): Promise<ConfirmImportState> {
  const user = await requireOnboardedUser();
  const selectedIds = formData.getAll("itemId").map(String);

  // A categoria de cada linha vem explícita do formulário agora (a Revisão
  // já mostra um seletor por linha, pré-preenchido com a melhor sugestão) —
  // e `keyword_<id>` só existe pras linhas marcadas "categorizar assim
  // sempre", virando uma regra permanente (ver recurringCategoryRules).
  const categoryByItem: Record<string, string> = {};
  const keywordByItem: Record<string, string> = {};
  for (const id of selectedIds) {
    const categoryId = formData.get(`category_${id}`);
    if (typeof categoryId === "string" && categoryId) categoryByItem[id] = categoryId;
    const keyword = formData.get(`keyword_${id}`);
    if (typeof keyword === "string" && keyword.trim()) keywordByItem[id] = keyword.trim();
  }

  const { count } = await confirmStatementImport(user.id, documentId, selectedIds, categoryByItem, keywordByItem);

  revalidatePath("/conta");
  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
  revalidatePath("/patrimonio");

  redirect(`/lancamentos?imported=${count}`);
}
