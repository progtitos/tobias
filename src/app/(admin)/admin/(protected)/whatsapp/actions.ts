"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createWhatsAppCampaign, sendWhatsAppCampaign, resolveWhatsAppAudience } from "@/services/whatsappMarketing";

export type CreateWhatsAppCampaignState = { error?: string } | undefined;

export async function previewWhatsAppAudienceAction(): Promise<number> {
  await requireAdmin();
  const recipients = await resolveWhatsAppAudience();
  return recipients.length;
}

export async function createWhatsAppCampaignAction(
  _prev: CreateWhatsAppCampaignState,
  formData: FormData
): Promise<CreateWhatsAppCampaignState> {
  await requireAdmin();
  const templateName = String(formData.get("templateName") ?? "").trim();
  const templateLanguage = String(formData.get("templateLanguage") ?? "").trim() || "pt_BR";
  if (!templateName) return { error: "Informe o nome exato do template aprovado pela Meta." };

  await createWhatsAppCampaign({ templateName, templateLanguage });
  revalidatePath("/admin/whatsapp");
}

export async function sendWhatsAppCampaignAction(campaignId: string): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    await sendWhatsAppCampaign(campaignId);
    revalidatePath("/admin/whatsapp");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao enviar a campanha." };
  }
}
