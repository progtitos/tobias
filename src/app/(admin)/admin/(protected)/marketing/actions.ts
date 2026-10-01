"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import {
  createEmailCampaign,
  sendEmailCampaign,
  resolveEmailAudience,
  type EmailAudienceSegment,
} from "@/services/emailMarketing";

export type CreateCampaignState = { error?: string } | undefined;

function parseSegment(formData: FormData): EmailAudienceSegment {
  return {
    leadStatuses: formData.getAll("leadStatuses") as EmailAudienceSegment["leadStatuses"],
    userStatuses: formData.getAll("userStatuses") as EmailAudienceSegment["userStatuses"],
  };
}

export async function previewAudienceAction(formData: FormData): Promise<number> {
  await requireAdmin();
  const recipients = await resolveEmailAudience(parseSegment(formData));
  return recipients.length;
}

export async function createCampaignAction(_prev: CreateCampaignState, formData: FormData): Promise<CreateCampaignState> {
  await requireAdmin();
  const subject = String(formData.get("subject") ?? "").trim();
  const bodyHtml = String(formData.get("bodyHtml") ?? "").trim();
  if (!subject) return { error: "Dê um assunto para a campanha." };
  if (!bodyHtml) return { error: "O corpo do e-mail não pode ficar vazio." };

  const segment = parseSegment(formData);
  if (!segment.leadStatuses?.length && !segment.userStatuses?.length) {
    return { error: "Selecione pelo menos um segmento de audiência." };
  }

  await createEmailCampaign({ subject, bodyHtml, segment });
  revalidatePath("/admin/marketing");
}

export async function sendCampaignAction(campaignId: string): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    await sendEmailCampaign(campaignId);
    revalidatePath("/admin/marketing");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao enviar a campanha." };
  }
}
