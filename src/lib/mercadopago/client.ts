import "server-only";
import { MercadoPagoConfig, PreApproval } from "mercadopago";

let cachedConfig: MercadoPagoConfig | null = null;

function getConfig(): MercadoPagoConfig {
  if (cachedConfig) return cachedConfig;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "MERCADOPAGO_ACCESS_TOKEN não configurado — configure suas credenciais do Mercado Pago no .env antes de tentar criar uma assinatura."
    );
  }
  cachedConfig = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
  return cachedConfig;
}

export function getPreApprovalClient(): PreApproval {
  return new PreApproval(getConfig());
}

export function getMercadoPagoAccessToken(): string {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
  return accessToken;
}
