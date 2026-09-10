import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { whatsappConnections, users } from "@/lib/db/schema";
import { sendChatMessage } from "@/services/chat";
import { submitOnboardingMessage } from "@/services/onboarding";

// ============================================================================
// WhatsApp Business API integration — architecture only (spec §33).
//
// The MVP ships with zero live WhatsApp connectivity: no provider account is
// configured, so every outbound call below is a logged no-op, never a faked
// "delivered" response. What this file does provide is the shape the real
// integration will drop into — identifyUserByPhone + receiveMessage already
// route into the exact same chat/onboarding pipeline the in-app UI uses, so
// wiring a real provider later means implementing WhatsAppProvider and
// filling in the webhook parsing, not redesigning how messages are handled.
// ============================================================================

export type WhatsAppInboundMessage = {
  from: string; // E.164 phone number
  text?: string;
  mediaUrl?: string;
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

function getProvider(): WhatsAppProvider {
  // Future: read process.env.WHATSAPP_PROVIDER ("meta_cloud_api" | "twilio")
  // and return a real implementation here. Intentionally not implemented —
  // the spec scopes this MVP to having the architecture ready, not a live
  // WhatsApp connection.
  return new NoopWhatsAppProvider();
}

export const WhatsAppService = {
  /** Looks up which Tobias account a WhatsApp phone number belongs to, if any. */
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
   * Entry point for a normalized inbound WhatsApp message. Routes text
   * through the same AI pipeline (onboarding vs. main chat) the in-app UI
   * uses, so behavior is identical regardless of channel.
   */
  async receiveMessage(message: WhatsAppInboundMessage): Promise<void> {
    const user = await this.identifyUserByPhone(message.from);
    if (!user) {
      await this.sendMessage(
        message.from,
        "Não encontramos uma conta Tobias vinculada a este número ainda. Abra o app e conecte seu WhatsApp em Configurações."
      );
      return;
    }

    if (message.mediaType === "audio" && message.mediaUrl) {
      await this.processAudio(message.mediaUrl);
      return;
    }
    if (message.mediaType === "image" && message.mediaUrl) {
      await this.processImage(message.mediaUrl, user.id);
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
   * (or Gemini's audio input) wired in — not implemented in this MVP.
   */
  async processAudio(_mediaUrl: string): Promise<string> {
    throw new Error("WhatsAppService.processAudio is not implemented yet — no speech-to-text provider is configured.");
  },

  /**
   * Will download the inbound image and hand it to the same receipt OCR
   * pipeline the in-app photo upload uses (see services/receipts.ts). Needs
   * a WhatsApp media-download step wired in — not implemented in this MVP.
   */
  async processImage(_mediaUrl: string, _userId: string): Promise<void> {
    throw new Error("WhatsAppService.processImage is not implemented yet — no WhatsApp media downloader is configured.");
  },
};
