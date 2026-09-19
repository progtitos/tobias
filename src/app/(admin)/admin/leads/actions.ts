"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { importLeadsFromCsv, updateLeadStatus } from "@/services/admin";
import { revalidatePath } from "next/cache";

export type ImportLeadsState = { error?: string; success?: { imported: number; skipped: number; total: number } } | undefined;

export async function importLeadsAction(_prev: ImportLeadsState, formData: FormData): Promise<ImportLeadsState> {
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Selecione um arquivo CSV." };
  if (!file.name.toLowerCase().endsWith(".csv")) return { error: "O arquivo precisa ser .csv." };

  const text = await file.text();
  const source = `csv_import_${new Date().toISOString().slice(0, 10)}_${file.name}`;

  try {
    const result = await importLeadsFromCsv(text, source);
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { success: result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao importar o CSV." };
  }
}

export async function updateLeadStatusAction(leadId: string, status: string) {
  await requireAdmin();
  await updateLeadStatus(leadId, status as Parameters<typeof updateLeadStatus>[1]);
  revalidatePath("/admin/leads");
}
