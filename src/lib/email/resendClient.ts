import "server-only";
import { Resend } from "resend";

// ============================================================================
// Resend (e-mail marketing, Admin › Marketing) — escolhido pelo Thiago
// (2026-09-30). Mesmo padrão do Mercado Pago/WhatsApp: nada tenta enviar de
// verdade até RESEND_API_KEY e RESEND_FROM_EMAIL estarem configurados (ver
// .env.example); até lá, getEmailConfigStatus() reporta "não configurado" e
// a tela de Marketing mostra um aviso em vez de deixar enviar.
// ============================================================================

let cachedClient: Resend | null = null;

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function getClient(): Resend {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurado.");
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export function getFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL não configurado.");
  return from;
}

export type ResendBatchItem = { to: string; subject: string; html: string };

/**
 * Envia em lotes de até 100 (limite do endpoint de batch do Resend) — muito
 * mais rápido e menos sujeito a timeout de função serverless do que uma
 * chamada por destinatário. Cada item do lote pode falhar independente do
 * resto (o Resend retorna um array de resultados na mesma ordem da entrada).
 */
export async function sendEmailBatch(
  items: ResendBatchItem[]
): Promise<Array<{ to: string; ok: boolean; error?: string }>> {
  const from = getFromAddress();
  const client = getClient();
  const results: Array<{ to: string; ok: boolean; error?: string }> = [];

  const BATCH_SIZE = 100;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const { data, error } = await client.batch.send(
      chunk.map((item) => ({ from, to: item.to, subject: item.subject, html: item.html }))
    );

    if (error) {
      // Falha no lote inteiro (ex.: chave inválida) — marca todo o chunk como falho.
      for (const item of chunk) results.push({ to: item.to, ok: false, error: error.message });
      continue;
    }

    // A API do Resend devolve um id por e-mail enviado, na mesma ordem da
    // requisição; ausência de erro no lote = todos os itens do chunk foram aceitos.
    chunk.forEach((item, idx) => {
      const sent = data?.data?.[idx];
      results.push({ to: item.to, ok: Boolean(sent?.id) });
    });
  }

  return results;
}
