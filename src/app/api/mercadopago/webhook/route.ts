import { NextRequest, NextResponse } from "next/server";
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from "mercadopago";
import { getPreApprovalClient } from "@/lib/mercadopago/client";
import {
  activateTrialFromPreapproval,
  markSubscriptionActive,
  markSubscriptionCanceled,
  markSubscriptionPastDue,
  fetchAuthorizedPaymentStatus,
} from "@/services/subscription";

// ============================================================================
// Mercado Pago webhook — receives "preapproval" (subscription) and
// "subscription_authorized_payment" (each recurring charge) notifications.
//
// Mercado Pago sends almost no data in the body — just an id to look up —
// and identifies the request with `x-signature`/`x-request-id` headers plus
// a `data.id` query param, which we verify with the SDK's own
// WebhookSignatureValidator before trusting anything. Fails closed: no
// MERCADOPAGO_WEBHOOK_SECRET configured, or a signature that doesn't check
// out, and we reject with 401 rather than trusting an unverified payload —
// this endpoint updates real subscription/billing state, unlike the
// WhatsApp webhook stub which just no-ops when unconfigured.
// ============================================================================

export async function POST(req: NextRequest) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[mercadopago webhook] MERCADOPAGO_WEBHOOK_SECRET não configurado — rejeitando notificação.");
    return NextResponse.json({ error: "webhook not configured" }, { status: 401 });
  }

  let body: { type?: string; action?: string; data?: { id?: string } } = {};
  try {
    body = await req.json();
  } catch {
    // Mercado Pago occasionally pings with an empty body — nothing to
    // validate or act on, acknowledge and move on.
    return NextResponse.json({ ok: true });
  }

  const dataId = req.nextUrl.searchParams.get("data.id") ?? body.data?.id ?? null;
  const topic = req.nextUrl.searchParams.get("type") ?? body.type ?? null;

  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      dataId,
      secret,
      toleranceSeconds: 300,
    });
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      console.error("[mercadopago webhook] assinatura inválida", err.reason, { requestId: err.requestId });
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
    throw err;
  }

  if (!dataId) return NextResponse.json({ ok: true });

  try {
    if (topic === "subscription_preapproval" || topic === "preapproval") {
      const preapproval = await getPreApprovalClient().get({ id: dataId });
      if (preapproval.status === "authorized") {
        await activateTrialFromPreapproval(dataId);
      } else if (preapproval.status === "cancelled" || preapproval.status === "canceled") {
        await markSubscriptionCanceled(dataId);
      }
      // "pending" (still on the hosted checkout) and "paused" need no action here.
    } else if (topic === "subscription_authorized_payment") {
      const { status, preapprovalId } = await fetchAuthorizedPaymentStatus(dataId);
      if (preapprovalId && status === "processed") {
        await markSubscriptionActive(preapprovalId);
      } else if (preapprovalId && (status === "rejected" || status === "cancelled")) {
        await markSubscriptionPastDue(preapprovalId);
      }
    }
    // Other topics (payment, merchant_order, etc.) aren't relevant to
    // subscription state — acknowledge and ignore.
  } catch (err) {
    console.error("[mercadopago webhook] falha ao processar notificação", topic, dataId, err);
    // Still 200 — Mercado Pago retries aggressively on non-2xx, and a
    // transient DB/API hiccup shouldn't trigger a retry storm. The next
    // webhook (or the person landing on /pagamento-pendente and retrying)
    // will pick it back up.
  }

  return NextResponse.json({ ok: true });
}

// Mercado Pago also does a GET ping when you first register the webhook URL
// in the dashboard, to confirm the endpoint responds.
export async function GET() {
  return NextResponse.json({ ok: true });
}
