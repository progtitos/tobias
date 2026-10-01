import { NextRequest, NextResponse } from "next/server";
import { unsubscribeEmail, verifyUnsubscribeToken } from "@/services/emailMarketing";

// ============================================================================
// Link público de descadastro (rodapé de toda campanha de e-mail, ver
// withUnsubscribeFooter em services/emailMarketing.ts). Sem autenticação de
// propósito — quem recebeu o e-mail precisa conseguir descadastrar num
// clique, sem precisar logar. O token (HMAC do e-mail) é o que impede
// alguém descadastrar um e-mail de terceiro só adivinhando a URL.
// ============================================================================

function htmlPage(title: string, message: string): NextResponse {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>body{font-family:system-ui,sans-serif;background:#14181c;color:#f5f6f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
main{max-width:420px;text-align:center}h1{font-size:20px;margin-bottom:8px}p{color:rgba(245,246,245,.7);font-size:14px}</style>
</head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  const token = req.nextUrl.searchParams.get("token");
  const campaignId = req.nextUrl.searchParams.get("campaignId") ?? undefined;

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return htmlPage("Link inválido", "Este link de descadastro não é válido ou expirou.");
  }

  await unsubscribeEmail(email, campaignId);
  return htmlPage("Você foi descadastrado", `O e-mail ${email} não vai mais receber mensagens de marketing do Tobias.`);
}
