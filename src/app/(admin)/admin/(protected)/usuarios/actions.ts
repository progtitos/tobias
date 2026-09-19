"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { updateUserForAdmin, softDeleteUserForAdmin, type AdminUserEditableFields } from "@/services/admin";
import { userRoleEnum, subscriptionPlanEnum, subscriptionStatusEnum } from "@/lib/db/schema";

export type UpdateUserState = { error?: string; success?: boolean } | undefined;

function isOneOf<T extends string>(values: readonly T[], v: FormDataEntryValue | null): v is T {
  return typeof v === "string" && (values as readonly string[]).includes(v);
}

export async function updateUserAction(_prev: UpdateUserState, formData: FormData): Promise<UpdateUserState> {
  await requireAdmin();

  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) return { error: "Usuário inválido." };

  const name = formData.get("name");
  const email = formData.get("email");
  const role = formData.get("role");
  const subscriptionPlan = formData.get("subscriptionPlan");
  const subscriptionStatus = formData.get("subscriptionStatus");
  const trialEndsAt = formData.get("trialEndsAt");

  if (typeof name !== "string" || !name.trim()) return { error: "Nome é obrigatório." };
  if (typeof email !== "string" || !email.trim()) return { error: "E-mail é obrigatório." };
  if (!isOneOf(userRoleEnum.enumValues, role)) return { error: "Cargo inválido." };
  if (!isOneOf(subscriptionPlanEnum.enumValues, subscriptionPlan)) return { error: "Plano inválido." };
  if (!isOneOf(subscriptionStatusEnum.enumValues, subscriptionStatus)) return { error: "Status inválido." };
  if (typeof trialEndsAt !== "string" || !trialEndsAt) return { error: "Data de trial inválida." };

  const parsedTrialEndsAt = new Date(trialEndsAt);
  if (Number.isNaN(parsedTrialEndsAt.getTime())) return { error: "Data de trial inválida." };

  const fields: AdminUserEditableFields = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    subscriptionPlan,
    subscriptionStatus,
    trialEndsAt: parsedTrialEndsAt,
  };

  try {
    await updateUserForAdmin(userId, fields);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao salvar." };
  }

  revalidatePath("/admin/usuarios");
  return { success: true };
}

export async function deleteUserAction(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    throw new Error("Você não pode excluir a própria conta admin por aqui.");
  }
  await softDeleteUserForAdmin(userId);
  revalidatePath("/admin/usuarios");
}
