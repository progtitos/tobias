import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { whatsappConnections, users } from "@/lib/db/schema";
import { sendChatMessage } from "@/services/chat";
import { submitOnboardingMessage } from "@/services/onboarding";

// ============================================================================
// WhatsApp Business API integration (Meta Cloud API).
//
// identifyUserByPhone + receiveMessage route into the exact same
// chat/onboarding pipeline the in-app UI uses, so this channel behaves
// identically to the web app once a number is connected. Nothing here talks
// to Meta until WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID are both set
// (see .env.example) — until then, getProvider() falls back to a logged
// no-op so the rest of the app never has to special-case "WhatsApp isn't
// configured yet".
// ============================================================================

export type WhatsAppInboundMessage = {
  from: string; // E.164 phone number
  text?: string;
  mediaUrl?: string; // for image/audio, this is actually the Meta *media id*, not a URL — see webhook route
  mediaType?: "image" | "audio" | "document";
  timestamp: Date;
};

export interface WhatsAppProvider {
  sendMessage(to: string, text: string): Promise<void>;
  sendMedia(to: string, mediaUrl: string, caption?: string): Promise<void>;
}

class NoopWhatsAppProvider implements WhatsAppProvider {
  async sendMessage(to: string, text: string) {
    console.warn(`[whatsapp] no provider configured — would send to ${to}: "${text.slice(0, 80)}"`);
  }
  async sendMedia(to: string, mediaUrl: string, caption?: string) {
    console.warn(`[whatsapp] no provider configured — would send media to ${to}: ${mediaUrl}${caption ? ` (${caption})` : ""}`);
  }
}

function graphApiVersion(): string {
  return process.env.WHATSAPP_GRAPH_API_VERSION || "v24.0";
}

function graphApiUrl(path: string): string {
  return `https://graph.facebook.com/${graphApiVersion()}/${path}`;
}

/** Talks to the real WhatsApp Cloud API (Meta) — see docs.developers.facebook.com/whatsapp. */
class MetaCloudApiProvider implements WhatsAppProvider {
  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string
  ) {}

  private async postMessage(body: Record<string, unknown>): Promise<void> {
    const res = await fetch(graphApiUrl(`${this.phoneNumberId}/messages`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`[whatsapp] Meta Cloud API request failed (${res.status}): ${errorText}`);
    }
  }

  async sendMessage(to: string, text: string): Promise<void> {
    await this.postMessage({ to, type: "text", text: { body: text } });
  }

  async sendMedia(to: string, mediaUrl: string, caption?: string): Promise<void> {
    await this.postMessage({ to, type: "image", image: { link: mediaUrl, caption } });
  }
}

let cachedProvider: WhatsAppProvider | null = null;

function getProvider(): WhatsAppProvider {
  if (cachedProvider) return cachedProvider;
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  cachedProvider =
    token && phoneNumberId ? new MetaCloudApiProvider(phoneNumberId, token) : new NoopWhatsAppProvider();
  return cachedProvider;
}

/**
 * Resolves a Meta media id (what webhooks give you, never a direct URL) into
 * actual bytes: one authenticated call to look up the short-lived download
 * URL, then another to fetch it — both need the same bearer token.
 */
async function downloadMetaMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!token) {
    throw new Error("WHATSAPP_API_TOKEN não configurado — não é possível baixar mídia do WhatsApp.");
  }

  const lookupRes = await fetch(graphApiUrl(mediaId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!lookupRes.ok) {
    throw new Error(`[whatsapp] falha ao resolver mídia ${mediaId}: ${lookupRes.status}`);
  }
  const meta = (await lookupRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) {
    throw new Error(`[whatsapp] resposta da Media API sem "url" para ${mediaId}`);
  }

  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!fileRes.ok) {
    throw new Error(`[whatsapp] falha ao baixar mídia ${mediaId}: ${fileRes.status}`);
  }
  const arrayBuffer = await fileRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: meta.mime_type || "application/octet-stream" };
}

function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

export const WhatsAppService = {
  /** Looks up which Tobias account a WhatsApp phone number belongs to, if any (only once opted in). */
  async identifyUserByPhone(phone: string) {
    const [connection] = await db
      .select()
      .from(whatsappConnections)
      .where(eq(whatsappConnections.phone, phone))
      .limit(1);
    if (!connection || !connection.optedIn) return null;

    const [user] = await db.select().from(users).where(eq(users.id, connection.userId)).limit(1);
    return user ?? null;
  },

  async sendMessage(to: string, text: string): Promise<void> {
    await getProvider().sendMessage(to, text);
  },

  async sendMedia(to: string, mediaUrl: string, caption?: string): Promise<void> {
    await getProvider().sendMedia(to, mediaUrl, caption);
  },

  /**
   * Called from Settings when the user types a phone number to connect.
   * Never marks the connection verified on its own — it only sends a code
   * to that number and stores it, so ownership is proven by the person
   * replying with it on WhatsApp (handled in receiveMessage below), not by
   * whoever happens to be typing into the Tobias form.
   */
  async requestConnection(userId: string, phone: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const [existing] = await db
      .select()
      .from(whatsappConnections)
      .where(eq(whatsappConnections.phone, phone))
      .limit(1);
    if (existing && existing.userId !== userId) {
      return { ok: false, error: "Esse número já está conectado a outra conta Tobias." };
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    await db
      .insert(whatsappConnections)
      .values({ userId, phone, verificationCode: code, verificationCodeExpiresAt: expiresAt })
      .onConflictDoUpdate({
        target: whatsappConnections.userId,
        set: {
          phone,
          verified: false,
          verifiedAt: null,
          optedIn: false,
          verificationCode: code,
          verificationCodeExpiresAt: expiresAt,
        },
      });

    await this.sendMessage(
      phone,
      `Seu código de verificação do Tobias é ${code}. Responda esta mensagem no WhatsApp com o código para conectar seu número. Ele expira em 10 minutos.`
    );
    return { ok: true };
  },

  async disconnect(userId: string): Promise<void> {
    await db.delete(whatsappConnections).where(eq(whatsappConnections.userId, userId));
  },

  /**
   * Entry point for a normalized inbound WhatsApp message. First checks
   * whether this number is mid-verification (waiting for the code sent by
   * requestConnection); once verified, routes text through the same
   * chat/onboarding pipeline the in-app UI uses.
   */
  async receiveMessage(message: WhatsAppInboundMessage): Promise<void> {
    const [connection] = await db
      .select()
      .from(whatsappConnections)
      .where(eq(whatsappConnections.phone, message.from))
      .limit(1);

    if (connection && !connection.verified) {
      const submittedCode = message.text?.trim();
      const stillValid = !!connection.verificationCodeExpiresAt && connection.verificationCodeExpiresAt > new Date();

      if (submittedCode && stillValid && submittedCode === connection.verificationCode) {
        await db
          .update(whatsappConnections)
          .set({
            verified: true,
            verifiedAt: new Date(),
            optedIn: true,
            verificationCode: null,
            verificationCodeExpiresAt: null,
          })
          .where(eq(whatsappConnections.id, connection.id));
        await this.sendMessage(
          message.from,
          "WhatsApp conectado! A partir de agora você pode conversar comigo por aqui, do mesmo jeito que no app."
        );
      } else {
        await this.sendMessage(
          message.from,
          "Código inválido ou expirado. Gere um novo em Configurações no app do Tobias."
        );
      }
      return;
    }

    if (!connection?.optedIn) {
      await this.sendMessage(
        message.from,
        "Não encontramos uma conta Tobias vinculada a este número ainda. Abra o app e conecte seu WhatsApp em Configurações."
      );
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, connection.userId)).limit(1);
    if (!user) return; // connection row without a user shouldn't happen (FK), but keeps this defensive

    if (message.mediaType === "audio" && message.mediaUrl) {
      try {
        await this.processAudio(message.mediaUrl);
      } catch (err) {
        console.error("[whatsapp] falha ao processar áudio", err);
        await this.sendMessage(message.from, "Ainda não consigo ouvir áudios por aqui. Manda em texto?");
      }
      return;
    }
    if (message.mediaType === "image" && message.mediaUrl) {
      try {
        await this.processImage(message.mediaUrl, user.id);
        await this.sendMessage(message.from, "Recebi sua nota fiscal! Confira os detalhes e confirme no app.");
      } catch (err) {
        console.error("[whatsapp] falha ao processar imagem", err);
        await this.sendMessage(message.from, "Não consegui ler essa imagem agora. Tenta de novo em instantes?");
      }
      return;
    }
    if (!message.text) return;

    const turn = user.onboardingCompleted
      ? await sendChatMessage(user.id, message.text)
      : await submitOnboardingMessage(user.id, message.text);

    await db
      .update(whatsappConnections)
      .set({ lastMessageAt: new Date() })
      .where(eq(whatsappConnections.userId, user.id));

    await this.sendMessage(message.from, turn.reply);
  },

  /**
   * Will transcribe a voice note before feeding the transcript into the same
   * chat pipeline as a normal text message. Needs a speech-to-text provider
   * (or Gemini's audio input) wired in — not implemented yet.
   */
  async processAudio(_mediaId: string): Promise<string> {
    throw new Error("WhatsAppService.processAudio is not implemented yet — no speech-to-text provider is configured.");
  },

  /**
   * Downloads the inbound image from Meta's Media API and hands it to the
   * same receipt OCR pipeline the in-app photo upload uses.
   */
  async processImage(mediaId: string, userId: string): Promise<void> {
    const { buffer, mimeType } = await downloadMetaMedia(mediaId);
    const { processReceiptUpload } = await import("@/services/receipts");
    await processReceiptUpload(userId, [{ buffer, mimeType }]);
  },
};
