"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { importLeadsFromFile, updateLeadStatus } from "@/services/admin";
import { revalidatePath } from "next/cache";

export type ImportLeadsState = { error?: string; success?: { imported: number; skipped: number; total: number } } | undefined;

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

export async function importLeadsAction(_prev: ImportLeadsState, formData: FormData): Promise<ImportLeadsState> {
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Selecione um arquivo CSV ou Excel." };
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return { error: "O arquivo precisa ser .csv, .xlsx ou .xls." };
  }

  const source = `import_${new Date().toISOString().slice(0, 10)}_${file.name}`;

  try {
    const result = await importLeadsFromFile(file, source);
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { success: result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao importar o arquivo." };
  }
}

export async function updateLeadStatusAction(leadId: string, status: string) {
  await requireAdmin();
  await updateLeadStatus(leadId, status as Parameters<typeof updateLeadStatus>[1]);
  revalidatePath("/admin/leads");
}
