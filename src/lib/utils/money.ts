const formatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "R$ 0,00";
  return formatter.format(value);
}

/** Mesmo formato de formatBRL ("1.234,56"), sem o prefixo "R$" — pro texto
 * que fica dentro de um <input> (CurrencyInput), onde o "R$" já aparece como
 * label/prefixo separado. */
export function formatBRLInput(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return numberFormatter.format(value);
}

/** Parses user-typed Brazilian currency input ("1.234,56" or "1234.56" or "1234") into a number. */
export function parseBRLInput(input: string): number {
  const cleaned = input.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  // If it has both , and . assume , is decimal (pt-BR) and . is thousands.
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(",", ".")) || 0;
  }
  return Number(cleaned) || 0;
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}
