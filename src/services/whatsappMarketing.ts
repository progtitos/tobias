import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { whatsappConnections, whatsappCampaigns, whatsappCampaignRecipients } from "@/lib/db/schema";
import { WhatsAppService } from "@/lib/whatsapp/WhatsAppService";

// ============================================================================
// Admin › WhatsApp (disparo em massa), pedido do Thiago (2026-09-30).
//
// Diferente do e-mail, aqui não existe "escolher provedor" — já usa a mesma
// conta WhatsApp Business (WHATSAPP_API_TOKEN/WHATSAPP_PHONE_NUMBER_ID) que
// a verificação individual de usuário já usa. O que falta pra funcionar de
// verdade é a Meta aprovar pelo menos um template de mensagem de marketing
// pra essa conta (ver claude/setup-whatsapp-business-api.md) — sem isso,
// sendWhatsAppCampaign falha com uma mensagem clara em vez de tentar mandar
// texto livre (que a API da Meta recusaria mesmo, fora da janela de 24h).
//
// Audiência: só `whatsapp_connections` com `optedIn = true` — a pessoa
// verificou ativamente o número em Configurações, é o único consentimento
// de contato por WhatsApp que o produto tem hoje. Nenhum número é elegível
// só por existir num lead ou cadastro.
// ============================================================================

export type WhatsAppAudienceSegment = {
  onlyOptedIn: true; // sempre true — mantido explícito no jsonb por clareza, não é uma opção configurável
};

export async function resolveWhatsAppAudience(): Promise<{ phone: string; userId: string }[]> {
  const rows = await db
    .select({ phone: whatsappConnections.phone, userId: whatsappConnections.userId })
    .from(whatsappConnections)
    .where(and(eq(whatsappConnections.optedIn, true), eq(whatsappConnections.verified, true)));
  return rows;
}

export type WhatsAppCampaignRow = {
  id: string;
  templateName: string;
  templateLanguage: string;
  status: (typeof whatsappCampaigns.$inferSelect)["status"];
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  sentAt: Date | null;
};

export async function listWhatsAppCampaigns(): Promise<WhatsAppCampaignRow[]> {
  return db.select().from(whatsappCampaigns).orderBy(desc(whatsappCampaigns.createdAt));
}

export async function createWhatsAppCampaign(input: { templateName: string; templateLanguage: string }): Promise<string> {
  const recipients = await resolveWhatsAppAudience();
  const [row] = await db
    .insert(whatsappCampaigns)
    .values({
      templateName: input.templateName,
      templateLanguage: input.templateLanguage,
      segment: { onlyOptedIn: true },
      recipientCount: recipients.length,
    })
    .returning({ id: whatsappCampaigns.id });
  return row.id;
}

export async function sendWhatsAppCampaign(campaignId: string): Promise<void> {
  const configured = Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  if (!configured) {
    throw new Error("WhatsApp Business não está configurado (WHATSAPP_API_TOKEN/WHATSAPP_PHONE_NUMBER_ID).");
  }

  const [campaign] = await db.select().from(whatsappCampaigns).where(eq(whatsappCampaigns.id, campaignId)).limit(1);
  if (!campaign) throw new Error("Campanha não encontrada.");
  if (campaign.status === "SENDING" || campaign.status === "SENT") {
    throw new Error("Esta campanha já foi enviada ou está sendo enviada.");
  }

  const recipients = await resolveWhatsAppAudience();

  await db
    .update(whatsappCampaigns)
    .set({ status: "SENDING", recipientCount: recipients.length })
    .where(eq(whatsappCampaigns.id, campaignId));

  if (recipients.length === 0) {
    await db.update(whatsappCampaigns).set({ status: "SENT", sentAt: new Date() }).where(eq(whatsappCampaigns.id, campaignId));
    return;
  }

  let sentCount = 0;
  let failedCount = 0;
  const recipientRows: { campaignId: string; phone: string; status: "SENT" | "FAILED"; error: string | null; sentAt: Date | null }[] = [];

  for (const r of recipients) {
    try {
      await WhatsAppService.sendTemplate(r.phone, campaign.templateName, campaign.templateLanguage);
      sentCount++;
      recipientRows.push({ campaignId, phone: r.phone, status: "SENT", error: null, sentAt: new Date() });
    } catch (err) {
      failedCount++;
      recipientRows.push({
        campaignId,
        phone: r.phone,
        status: "FAILED",
        error: err instanceof Error ? err.message : "Erro desconhecido",
        sentAt: null,
      });
    }
  }

  await db.insert(whatsappCampaignRecipients).values(recipientRows);
  await db
    .update(whatsappCampaigns)
    .set({
      status: failedCount === 0 ? "SENT" : sentCount > 0 ? "SENT" : "FAILED",
      sentCount,
      failedCount,
      sentAt: new Date(),
    })
    .where(eq(whatsappCampaigns.id, campaignId));
}

export function getWhatsAppMarketingConfigStatus(): { configured: boolean } {
  return { configured: Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) };
}
