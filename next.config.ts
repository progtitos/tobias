import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, too small for the receipt-photo upload (up to 5
      // photos per Server Action call). Vercel's serverless functions have
      // their own hard, non-configurable 4.5MB request body cap, so this is
      // set below that with headroom — the client also compresses photos
      // before upload (see ReceiptUploadClient) so real-world payloads stay
      // well under either limit.
      bodySizeLimit: "4mb",
    },
  },
  // Segurança (adicionado 25/09/2026, auditoria pedida pelo Thiago): nenhum
  // header de segurança HTTP existia antes. Aplicados a toda rota do app —
  // nenhum deles depende de nada específico de uma página, então não há
  // trade-off aqui a não ser o padrão sensato de qualquer app com login.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede a página de ser carregada dentro de um <iframe> em outro
          // site (clickjacking) — o Tobias nunca precisa ser embutido.
          { key: "X-Frame-Options", value: "DENY" },
          // Impede o navegador de tentar "adivinhar" o tipo de um arquivo
          // servido (ex.: tratar um upload de usuário como script).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Força HTTPS por 2 anos, incluindo subdomínios — a Vercel já serve
          // tudo em HTTPS, isso garante que o navegador nunca tente HTTP de
          // novo mesmo que alguém digite o endereço sem "https://".
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Não manda a URL completa (que pode ter tokens de reset, IDs) como
          // referrer pra sites de terceiros ao clicar num link externo.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Desliga APIs sensíveis do navegador que o Tobias não usa.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
