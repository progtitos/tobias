// Catálogo dos bancos mais usados no Brasil pro seletor de "Nova conta" e pro
// selo que aparece nas linhas de Transações e Contas. Todo mundo tem logo real
// agora, baixado do mesmo repositório (github.com/Tgentil/Bancos-em-SVG, sem
// licença formal — as marcas seguem sendo propriedade de cada banco, decisão
// explícita do usuário de usar mesmo assim) e auto-hospedado em
// /public/bank-logos. Selo é um círculo (não mais o quadrado arredondado do
// mockup original).
export type BankMeta = {
  id: string;
  label: string;
  initials: string;
  className: string;
  // Arquivo de logo em /public/bank-logos. Três formas de usar, ver `logoMode`.
  logoFile?: string;
  // "self"  — o arquivo já traz o fundo colorido da marca (Itaú, Bradesco,
  //           Santander, Nubank, Mercado Pago); preenche quase todo o selo.
  // "bare"  — só o símbolo, sem fundo (BB, Caixa, Inter, C6); fica menor,
  //           centralizado sobre `className`.
  // "mask"  — símbolo de uma cor só, usado como máscara branca sobre
  //           `className` (PicPay) — recria o ícone oficial do app (P branco
  //           sobre verde) em vez do traço verde sobre verde do arquivo cru.
  logoMode?: "self" | "bare" | "mask";
};

export const BANKS: BankMeta[] = [
  {
    id: "nubank",
    label: "Nubank",
    initials: "nu",
    className: "bg-[#820ad1] text-white",
    logoFile: "/bank-logos/nubank.svg",
    logoMode: "self",
  },
  {
    id: "itau",
    label: "Itaú",
    initials: "itaú",
    className: "bg-[#ec7000] text-white",
    logoFile: "/bank-logos/itau.svg",
    logoMode: "self",
  },
  {
    id: "bradesco",
    label: "Bradesco",
    initials: "brad",
    className: "bg-[#cc092f] text-white",
    logoFile: "/bank-logos/bradesco.svg",
    logoMode: "self",
  },
  {
    id: "bb",
    label: "Banco do Brasil",
    initials: "BB",
    className: "bg-[#f6c500] text-[#0033a0]",
    logoFile: "/bank-logos/bb.svg",
    logoMode: "bare",
  },
  {
    id: "santander",
    label: "Santander",
    initials: "sant",
    className: "bg-[#ec0000] text-white",
    logoFile: "/bank-logos/santander.svg",
    logoMode: "self",
  },
  {
    id: "caixa",
    // Fundo branco em vez do azul da marca: o símbolo tem partes azuis e
    // alaranjadas, e em cima do próprio azul da Caixa a parte azul do X
    // desaparecia (mesma cor por cima da mesma cor).
    label: "Caixa",
    initials: "CEF",
    className: "bg-white text-[#0057a3] border border-black/10",
    logoFile: "/bank-logos/caixa.svg",
    logoMode: "bare",
  },
  {
    id: "inter",
    // Mesmo motivo da Caixa: o "in" laranja ficava invisível sobre um selo
    // laranja igual.
    label: "Inter",
    initials: "inter",
    className: "bg-white text-[#ff7a00] border border-black/10",
    logoFile: "/bank-logos/inter.svg",
    logoMode: "bare",
  },
  {
    id: "c6",
    label: "C6 Bank",
    initials: "C6",
    className: "bg-[#1a1a1a] text-white",
    logoFile: "/bank-logos/c6.svg",
    logoMode: "bare",
  },
  {
    id: "picpay",
    label: "PicPay",
    initials: "pp",
    className: "bg-[#21c25e] text-white",
    logoFile: "/bank-logos/picpay.svg",
    logoMode: "mask",
  },
  {
    id: "mp",
    label: "Mercado Pago",
    initials: "mp",
    className: "bg-[#00b1ea] text-[#023047]",
    logoFile: "/bank-logos/mp.svg",
    logoMode: "self",
  },
];

// Quem digitou o nome do banco antes do seletor existir (ou escolheu "Outro
// banco") cai aqui — mantém a mesma linguagem visual (selo circular) mas
// neutro, com as iniciais do que a pessoa digitou.
export const OTHER_BANK_ID = "outro";

export function findBank(bankName: string | null | undefined): BankMeta | null {
  if (!bankName) return null;
  const norm = bankName.trim().toLowerCase();
  return BANKS.find((b) => b.label.toLowerCase() === norm) ?? null;
}

export function fallbackInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toLowerCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
