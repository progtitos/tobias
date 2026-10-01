import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { eq, inArray, isNull, ne, and, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads, users, emailCampaigns, emailCampaignRecipients, emailUnsubscribes, leadStatusEnum, subscriptionStatusEnum } from "@/lib/db/schema";
import { isResendConfigured, sendEmailBatch } from "@/lib/email/resendClient";

// ============================================================================
// Admin › Marketing (e-mail), pedido do Thiago (2026-09-30), provedor Resend.
// Nada aqui envia de verdade até RESEND_API_KEY/RESEND_FROM_EMAIL estarem
// configurados (ver .env.example) — até lá, sendCampaign falha com uma
// mensagem clara em vez de tentar e quebrar silenciosamente.
// ============================================================================

export type EmailAudienceSegment = {
  leadStatuses?: (typeof leadStatusEnum.enumValues)[number][];
  userStatuses?: (typeof subscriptionStatusEnum.enumValues)[number][];
};

/** Resolve a segmentação em uma lista de e-mails únicos, já sem quem descadastrou. */
export async function resolveEmailAudience(segment: EmailAudienceSegment): Promise<string[]> {
  const emails = new Set<string>();

  if (segment.leadStatuses?.length) {
    const rows = await db
      .select({ email: leads.email })
      .from(leads)
      .where(inArray(leads.status, segment.leadStatuses));
    for (const r of rows) if (r.email) emails.add(r.email.trim().toLowerCase());
  }

  if (segment.userStatuses?.length) {
    // ne(role, "ADMIN"): segmentar por "assinante ativo"/"em trial" etc. é
    // pensado pra cliente de verdade — uma conta de staff que carrega esse
    // status por histórico ou valor padrão de criação não deveria poder
    // entrar numa campanha de marketing (pedido do Thiago, 01/10/2026, mesmo
    // motivo do filtro em adminFinance.ts/getAdminOverview).
    const rows = await db
      .select({ email: users.email })
      .from(users)
      .where(and(inArray(users.subscriptionStatus, segment.userStatuses), isNull(users.deletedAt), ne(users.role, "ADMIN")));
    for (const r of rows) if (r.email) emails.add(r.email.trim().toLowerCase());
  }

  if (emails.size === 0) return [];

  const unsubscribed = await db
    .select({ email: emailUnsubscribes.email })
    .from(emailUnsubscribes)
    .where(inArray(emailUnsubscribes.email, [...emails]));
  for (const r of unsubscribed) emails.delete(r.email);

  return [...emails];
}

export type EmailCampaignRow = {
  id: string;
  subject: string;
  bodyHtml: string;
  segment: EmailAudienceSegment;
  status: (typeof emailCampaigns.$inferSelect)["status"];
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  sentAt: Date | null;
};

export async function listEmailCampaigns(): Promise<EmailCampaignRow[]> {
  const rows = await db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt));
  return rows.map((r) => ({ ...r, segment: r.segment as EmailAudienceSegment }));
}

export async function createEmailCampaign(input: {
  subject: string;
  bodyHtml: string;
  segment: EmailAudienceSegment;
}): Promise<string> {
  const recipients = await resolveEmailAudience(input.segment);
  const [row] = await db
    .insert(emailCampaigns)
    .values({
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      segment: input.segment,
      recipientCount: recipients.length,
    })
    .returning({ id: emailCampaigns.id });
  return row.id;
}

const UNSUB_SECRET = process.env.EMAIL_UNSUB_SECRET || "tobias-unsub-fallback-2026-troque-em-producao";

/**
 * Token assinado (HMAC), não um segredo secreto guardado por e-mail — só
 * prova que quem clicou o link tem o link (recebeu o e-mail), suficiente
 * pra esse caso de uso (o pior cenário de forjar é descadastrar um e-mail
 * que não é seu, não vazamento de dado nenhum). Comparação em tempo
 * constante (timingSafeEqual) pra não abrir um oráculo de timing bobo.
 */
export function signUnsubscribeToken(email: string): string {
  return createHmac("sha256", UNSUB_SECRET).update(email.trim().toLowerCase()).digest("base64url");
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = Buffer.from(signUnsubscribeToken(email));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function unsubscribeEmail(email: string, campaignId?: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await db
    .insert(emailUnsubscribes)
    .values({ email: normalized, campaignId: campaignId ?? null })
    .onConflictDoNothing();
}

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

/** Rodapé de descadastro obrigatório em toda campanha — nunca deixado a critério do admin escrever (ou esquecer). */
function withUnsubscribeFooter(html: string, email: string, campaignId: string): string {
  const token = signUnsubscribeToken(email);
  const url = `${appUrl()}/api/email/unsubscribe?email=${encodeURIComponent(email)}&token=${token}&campaignId=${campaignId}`;
  return `${html}<hr style="margin-top:32px;border:none;border-top:1px solid #e5e5e5"/><p style="font-size:12px;color:#888;margin-top:12px">Você recebeu este e-mail porque tem uma conta ou é um contato do Tobias. <a href="${url}">Descadastrar</a></p>`;
}

/**
 * Envia a campanha para todos os destinatários resolvidos NO MOMENTO DO
 * ENVIO (não os congelados na criação) — evita mandar pra alguém que já
 * descadastrou entre criar e enviar. Grava um resultado por destinatário em
 * email_campaign_recipients pra dar visibilidade real do que aconteceu,
 * em vez de só um contador agregado.
 */
export async function sendEmailCampaign(campaignId: string): Promise<void> {
  if (!isResendConfigured()) {
    throw new Error("Resend não está configurado (RESEND_API_KEY/RESEND_FROM_EMAIL). Configure antes de enviar.");
  }

  const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId)).limit(1);
  if (!campaign) throw new Error("Campanha não encontrada.");
  if (campaign.status === "SENDING" || campaign.status === "SENT") {
    throw new Error("Esta campanha já foi enviada ou está sendo enviada.");
  }

  const segment = campaign.segment as EmailAudienceSegment;
  const recipients = await resolveEmailAudience(segment);

  await db
    .update(emailCampaigns)
    .set({ status: "SENDING", recipientCount: recipients.length })
    .where(eq(emailCampaigns.id, campaignId));

  if (recipients.length === 0) {
    await db.update(emailCampaigns).set({ status: "SENT", sentAt: new Date() }).where(eq(emailCampaigns.id, campaignId));
    return;
  }

  const results = await sendEmailBatch(
    recipients.map((email) => ({
      to: email,
      subject: campaign.subject,
      html: withUnsubscribeFooter(campaign.bodyHtml, email, campaignId),
    }))
  );

  await db.insert(emailCampaignRecipients).values(
    results.map((r) => ({
      campaignId,
      email: r.to,
      status: (r.ok ? "SENT" : "FAILED") as "SENT" | "FAILED",
      error: r.error ?? null,
      sentAt: r.ok ? new Date() : null,
    }))
  );

  const sentCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - sentCount;

  await db
    .update(emailCampaigns)
    .set({
      status: failedCount === 0 ? "SENT" : sentCount > 0 ? "SENT" : "FAILED",
      sentCount,
      failedCount,
      sentAt: new Date(),
    })
    .where(eq(emailCampaigns.id, campaignId));
}

export function getEmailConfigStatus(): { configured: boolean; fromAddress: string | null } {
  return {
    configured: isResendConfigured(),
    fromAddress: process.env.RESEND_FROM_EMAIL || null,
  };
}
