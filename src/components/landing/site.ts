/**
 * Configuração central da landing page.
 *
 * Diferente do protótipo original (um app Vite separado, apontando pra
 * https://tobias-pi.vercel.app via URL absoluta), esta versão vive DENTRO do
 * próprio app Next.js — então os links de login/cadastro são rotas relativas
 * de verdade, navegadas pelo <Link> do Next, não âncoras cruzando domínio.
 */
import type { BillingCycle } from "@/lib/billing/plans";

export const APP_LINKS = {
  login: "/login",
  signup: "/signup",
  signupWithPlan: (plano: BillingCycle) => `/signup?plano=${plano}`,
} as const;

export const NAV_LINKS = [
  { href: "#extratos", label: "Seus extratos" },
  { href: "#como-funciona", label: "Como o Tobias ajuda" },
  { href: "#pilares", label: "Metodologia" },
  { href: "#whatsapp", label: "Acompanhamento" },
  { href: "#planos", label: "Planos" },
  { href: "#perguntas", label: "Dúvidas" },
] as const;
