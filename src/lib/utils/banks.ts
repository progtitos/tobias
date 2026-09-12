// Catálogo dos bancos mais usados no Brasil pro seletor de "Nova conta" e pro
// selo que aparece nas linhas de Transações e Contas. Sem logo real de banco
// por enquanto — só cor + iniciais, num quadrado bem arredondado (estilo do
// ícone do app do Itaú), do jeito que foi aprovado no mockup de redesign.
export type BankMeta = {
  id: string;
  label: string;
  initials: string;
  className: string;
};

export const BANKS: BankMeta[] = [
  { id: "nubank", label: "Nubank", initials: "nu", className: "bg-[#820ad1] text-white" },
  { id: "itau", label: "Itaú", initials: "itaú", className: "bg-[#ec7000] text-white" },
  { id: "bradesco", label: "Bradesco", initials: "brad", className: "bg-[#cc092f] text-white" },
  { id: "bb", label: "Banco do Brasil", initials: "BB", className: "bg-[#f6c500] text-[#0033a0]" },
  { id: "santander", label: "Santander", initials: "sant", className: "bg-[#ec0000] text-white" },
  { id: "caixa", label: "Caixa", initials: "CEF", className: "bg-[#0057a3] text-white" },
  { id: "inter", label: "Inter", initials: "inter", className: "bg-[#ff7a00] text-white" },
  { id: "c6", label: "C6 Bank", initials: "C6", className: "bg-[#1a1a1a] text-white" },
  { id: "picpay", label: "PicPay", initials: "pp", className: "bg-[#21c25e] text-white" },
  { id: "mp", label: "Mercado Pago", initials: "mp", className: "bg-[#00b1ea] text-[#023047]" },
];

// Quem digitou o nome do banco antes do seletor existir (ou escolheu "Outro
// banco") cai aqui — mantém a mesma linguagem visual (quadrado arredondado)
// mas neutro, com as iniciais do que a pessoa digitou.
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
