import { NextRequest, NextResponse } from "next/server";
import { WhatsAppService, type WhatsAppInboundMessage } from "@/lib/whatsapp/WhatsAppService";

// ============================================================================
// WhatsApp Business API webhook — stub, not wired to a live provider.
//
// Shaped after the Meta Cloud API contract (GET verification handshake +
// POST message payloads) since that's the most common path to WhatsApp
// Business API, but nothing here talks to Meta yet: WHATSAPP_VERIFY_TOKEN is
// unset in every environment until a real WhatsApp Business account is
// connected, and this route is not registered as a webhook URL anywhere. It
// exists so the integration has a real landing point to point a provider at
// later, without redesigning the app-side pipeline (see WhatsAppService).
// ============================================================================

/** Meta's webhook verification handshake. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: "WhatsApp integration is not configured yet." }, { status: 501 });
  }

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

/**
 * Inbound message payloads. Parses the (documented, but not yet exercised
 * against a real account) Meta Cloud API shape into WhatsAppInboundMessage
 * and hands off to WhatsAppService — the actual behavior lives there so it's
 * shared with whatever provider eventually replaces this parsing step.
 */
export async function POST(request: NextRequest) {
  if (!process.env.WHATSAPP_VERIFY_TOKEN) {
    return NextResponse.json({ error: "WhatsApp integration is not configured yet." }, { status: 501 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const message = parseMetaCloudApiPayload(body);
  if (!message) {
    // Not every webhook call is a user message (delivery receipts, status
    // updates, etc.) — acknowledge and ignore rather than erroring.
    return NextResponse.json({ ok: true });
  }

  try {
    await WhatsAppService.receiveMessage(message);
  } catch (err) {
    console.error("[whatsapp webhook] failed to process inbound message", err);
    // Still 200 — WhatsApp providers retry aggressively on non-2xx and we
    // don't want a duplicate storm for an error that a retry won't fix.
  }

  return NextResponse.json({ ok: true });
}

function parseMetaCloudApiPayload(body: unknown): WhatsAppInboundMessage | null {
  const entry = (body as { entry?: unknown[] })?.entry?.[0] as
    | { changes?: { value?: { messages?: unknown[] } }[] }
    | undefined;
  const value = entry?.changes?.[0]?.value;
  const raw = value?.messages?.[0] as
    | {
        from?: string;
        timestamp?: string;
        text?: { body?: string };
        image?: { id?: string; caption?: string };
        audio?: { id?: string };
      }
    | undefined;

  if (!raw?.from) return null;

  const timestamp = raw.timestamp ? new Date(Number(raw.timestamp) * 1000) : new Date();

  if (raw.text?.body) {
    return { from: raw.from, text: raw.text.body, timestamp };
  }
  if (raw.image?.id) {
    // Meta sends a media *id*, not a URL — a real integration resolves it via
    // the Media API before this ever reaches WhatsAppService.processImage.
    return { from: raw.from, mediaType: "image", mediaUrl: raw.image.id, timestamp };
  }
  if (raw.audio?.id) {
    return { from: raw.from, mediaType: "audio", mediaUrl: raw.audio.id, timestamp };
  }
  return null;
}
