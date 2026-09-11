"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { deleteAccount } from "@/services/account";
import { destroySession } from "@/lib/auth/session";
import { cancelSubscription } from "@/services/subscription";
import { WhatsAppService } from "@/lib/whatsapp/WhatsAppService";
import { connectWhatsAppSchema } from "@/lib/validations/whatsapp";

export async function deleteAccountAction() {
  const user = await requireUser();
  await deleteAccount(user.id);
  await destroySession();
  redirect("/");
}

export type CancelSubscriptionState = { error?: string } | undefined;

export async function cancelSubscriptionAction(): Promise<CancelSubscriptionState> {
  const user = await requireUser();
  try {
    await cancelSubscription(user.id);
  } catch (err) {
    console.error("[settings] falha ao cancelar assinatura no Mercado Pago", err);
    return { error: "Não foi possível cancelar agora. Tente novamente em instantes." };
  }
  revalidatePath("/settings");
}

export type ConnectWhatsAppState = { error?: string } | undefined;

export async function connectWhatsAppAction(
  _prev: ConnectWhatsAppState,
  formData: FormData
): Promise<ConnectWhatsAppState> {
  const user = await requireUser();
  const parsed = connectWhatsAppSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Número inválido." };
  }

  try {
    const result = await WhatsAppService.requestConnection(user.id, parsed.data.phone);
    if (!result.ok) return { error: result.error };
  } catch (err) {
    console.error("[settings] falha ao iniciar conexão do WhatsApp", err);
    return { error: "Não foi possível enviar o código agora. Tente novamente em instantes." };
  }
  revalidatePath("/settings");
}

export async function disconnectWhatsAppAction() {
  const user = await requireUser();
  await WhatsAppService.disconnect(user.id);
  revalidatePath("/settings");
}
