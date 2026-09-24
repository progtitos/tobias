"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { deleteLead, deleteLeads, importLeadsFromFile, updateLeadForAdmin, updateLeadStatus } from "@/services/admin";
import { revalidatePath } from "next/cache";

export type ImportLeadsState = { error?: string; success?: { imported: number; skipped: number; total: number } } | undefined;
export type UpdateLeadState = { error?: string; success?: boolean } | undefined;

function revalidateLeads() {
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}

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
    revalidateLeads();
    return { success: result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao importar o arquivo." };
  }
}

export async function updateLeadStatusAction(leadId: string, status: string) {
  await requireAdmin();
  await updateLeadStatus(leadId, status as Parameters<typeof updateLeadStatus>[1]);
  revalidateLeads();
}

export async function updateLeadAction(_prev: UpdateLeadState, formData: FormData): Promise<UpdateLeadState> {
  await requireAdmin();

  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) return { error: "Lead inválido." };

  const rawName = formData.get("name");
  const rawEmail = formData.get("email");
  const rawPhone = formData.get("phone");
  const rawNotes = formData.get("notes");

  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
  const email = typeof rawEmail === "string" && rawEmail.trim() ? rawEmail.trim().toLowerCase() : null;
  const phone = typeof rawPhone === "string" && rawPhone.trim() ? rawPhone.trim() : null;
  const notes = typeof rawNotes === "string" && rawNotes.trim() ? rawNotes.trim() : null;

  // Mesma regra do import (importLeadsFromRows): um lead precisa de pelo
  // menos um jeito de identificar/contatar a pessoa.
  if (!name && !email && !phone) {
    return { error: "Preencha ao menos nome, e-mail ou telefone." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "E-mail inválido." };
  }

  try {
    await updateLeadForAdmin(leadId, { name, email, phone, notes });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao salvar." };
  }

  revalidateLeads();
  return { success: true };
}

export async function deleteLeadAction(leadId: string) {
  await requireAdmin();
  await deleteLead(leadId);
  revalidateLeads();
}

export async function deleteLeadsAction(leadIds: string[]): Promise<number> {
  await requireAdmin();
  const deleted = await deleteLeads(leadIds);
  revalidateLeads();
  return deleted;
}
