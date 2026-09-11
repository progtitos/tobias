/**
 * One-off script to confirm your Mercado Pago credentials and the
 * preapproval (assinatura) request are accepted by the real API, without
 * going through the whole signup form.
 *
 * This talks to the Mercado Pago SDK directly, instead of going through
 * src/services/subscription.ts or src/lib/mercadopago/client.ts — those
 * files start with `import "server-only"`, a marker Next.js's own bundler
 * strips out when building the app, but which throws unconditionally when
 * loaded directly by plain Node/tsx outside of Next (which is exactly what
 * happens when you run this script). This script only needs your Mercado
 * Pago credentials from .env, so it skips that wrapper (and the database)
 * entirely and talks to the mercadopago package straight up.
 *
 * Run it locally with:
 *
 *   npx tsx scripts/test-mercadopago-checkout.ts seu-email@exemplo.com
 *
 * It creates a real "pending" preapproval (a subscription waiting for
 * someone to enter a card on Mercado Pago's hosted checkout) — no card is
 * attached and nothing is ever charged just from running this. If it
 * prints an init_point URL, open it in a browser to see the real checkout
 * page Mercado Pago will show your users, then cancel that test
 * subscription from your Mercado Pago dashboard (Assinaturas) once you've
 * seen it, since it'll otherwise sit there forever as noise.
 */
import "dotenv/config";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import { PRICING_PLANS, type BillingCycle } from "../src/lib/billing/plans";
import type {
  AutoRecurringWithFreeTrial,
  PreApprovalRequest,
} from "mercadopago/dist/clients/preApproval/commonTypes";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npx tsx scripts/test-mercadopago-checkout.ts seu-email@exemplo.com");
    process.exit(1);
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("MERCADOPAGO_ACCESS_TOKEN não está definido no seu .env.");
    process.exit(1);
  }

  const cycle: BillingCycle = "MENSAL";
  const plan = PRICING_PLANS.find((p) => p.cycle === cycle)!;
  const trialDays = Number(process.env.APP_TRIAL_DAYS) || 15;
  // Mercado Pago rejects a localhost back_url ("Invalid value for back_url,
  // must be a valid URL") — it needs a real, public URL. This script only
  // exists to validate the request shape and credentials, so it hardcodes a
  // public placeholder instead of reading APP_URL from .env. The real app
  // (src/services/subscription.ts) still uses APP_URL for this, so signup
  // will hit this same error until APP_URL is set to your real deployed
  // domain (with https) — it can't be fully tested against localhost.
  const appUrl = "https://www.mercadopago.com.br";

  const autoRecurring: AutoRecurringWithFreeTrial = {
    frequency: plan.months,
    frequency_type: "months",
    transaction_amount: plan.price,
    currency_id: "BRL",
    free_trial: {
      frequency: trialDays,
      frequency_type: "days",
    },
  };

  const body: PreApprovalRequest = {
    reason: `Tobias (${plan.label})`,
    external_reference: "test-user-nao-existe",
    payer_email: email,
    back_url: `${appUrl}/onboarding`,
    auto_recurring: autoRecurring,
    status: "pending",
  };

  const config = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
  const preapproval = await new PreApproval(config).create({ body });

  console.log("Criado com sucesso:");
  console.log(JSON.stringify(preapproval, null, 2));
  console.log("\nAbra este link para ver a tela de checkout real:");
  console.log(preapproval.init_point);
}

main().catch((err) => {
  console.error("Falhou:", err);
  process.exit(1);
});
