/**
 * Parser de CSV bem simples pra extrato/fatura exportado em planilha — sem
 * IA, então mais barato e mais confiável que tentar "ver" uma planilha como
 * imagem (decisão registrada no tracker de redesign). Não tenta cobrir todo
 * formato de banco do Brasil: reconhece a forma mais comum de exportação
 * (uma linha por transação, colunas com data/descrição/valor em qualquer
 * ordem) e falha de forma clara — sem inventar dado — quando não consegue.
 */

export type ParsedCsvRow = {
  date: string; // ISO 8601
  description: string;
  amount: number; // sempre positivo
  type: "EXPENSE" | "INCOME";
};

export type ParsedCsvResult = { rows: ParsedCsvRow[] } | { error: string };

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells.map((c) => c.replace(/^"|"$/g, ""));
}

function detectDelimiter(headerLine: string): string {
  return (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0) ? ";" : ",";
}

const DATE_BR = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/;
const DATE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})/;

function parseDate(raw: string): string | null {
  const brMatch = raw.match(DATE_BR);
  if (brMatch) {
    const [, d, m, yRaw] = brMatch;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const isoMatch = raw.match(DATE_ISO);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/^R\$\s*/i, "");
  if (!cleaned) return null;
  const negative = /^-/.test(cleaned) || /^\(.*\)$/.test(cleaned);
  const digits = cleaned.replace(/[^\d,.-]/g, "");
  if (!digits) return null;
  let normalized = digits;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const value = Number(normalized.replace(/-/g, ""));
  if (Number.isNaN(value) || value === 0) return null;
  return negative ? -value : value;
}

/**
 * Recebe o texto cru do arquivo e devolve as transações reconhecidas.
 * Estratégia: acha, entre as primeiras linhas, qual coluna parece data e
 * qual parece valor (testando cada coluna contra os primeiros registros);
 * o resto das colunas não-vazias vira a descrição. Se nenhuma combinação
 * bater com confiança em pelo menos metade das linhas, desiste em vez de
 * arriscar ler tudo errado.
 */
export function parseCsvStatement(
  text: string,
  kind: "BANK_STATEMENT" | "INVOICE_STATEMENT" = "BANK_STATEMENT"
): ParsedCsvResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { error: "Arquivo vazio ou sem linhas suficientes." };

  const delimiter = detectDelimiter(lines[0]);
  const rows = lines.map((l) => splitCsvLine(l, delimiter));
  const columnCount = Math.max(...rows.map((r) => r.length));

  // A primeira linha só é cabeçalho de verdade se NÃO parecer uma transação
  // (nenhuma célula é data nem valor) — alguns extratos não têm cabeçalho.
  const firstRowLooksLikeData = rows[0].some((c) => parseDate(c) || parseAmount(c));
  const dataRows = firstRowLooksLikeData ? rows : rows.slice(1);
  if (dataRows.length === 0) return { error: "Não encontrei nenhuma linha de transação no arquivo." };

  let dateCol = -1;
  let amountCol = -1;
  for (let col = 0; col < columnCount; col++) {
    const sample = dataRows.slice(0, 20).map((r) => r[col] ?? "");
    const dateHits = sample.filter((c) => parseDate(c)).length;
    const amountHits = sample.filter((c) => parseAmount(c)).length;
    if (dateCol === -1 && dateHits >= sample.length * 0.7) dateCol = col;
    if (amountHits >= sample.length * 0.7 && (amountCol === -1 || amountHits > 0)) {
      // Prefere a ÚLTIMA coluna numérica plausível quando há mais de uma
      // (ex: "saldo" costuma vir depois de "valor") — heurística simples,
      // não perfeita, mas evita ficar preso na primeira coluna numérica.
      amountCol = col;
    }
  }

  if (dateCol === -1 || amountCol === -1 || dateCol === amountCol) {
    return {
      error:
        "Não consegui identificar as colunas de data e valor neste CSV. Tente exportar em PDF ou enviar uma foto/print do extrato.",
    };
  }

  const parsedRows: ParsedCsvRow[] = [];
  for (const r of dataRows) {
    const date = parseDate(r[dateCol] ?? "");
    const amount = parseAmount(r[amountCol] ?? "");
    if (!date || amount === null) continue;
    const description =
      r
        .filter((_, i) => i !== dateCol && i !== amountCol)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim() || "Transação importada";
    // Extrato de conta: sinal negativo é o próprio banco marcando débito, e
    // isso é confiável. Fatura de cartão costuma vir SEM sinal (é tudo
    // compra por padrão) — só um sinal negativo explícito é um estorno.
    const type: "EXPENSE" | "INCOME" =
      kind === "BANK_STATEMENT" ? (amount < 0 ? "EXPENSE" : "INCOME") : amount < 0 ? "INCOME" : "EXPENSE";
    parsedRows.push({ date, description, amount: Math.abs(amount), type });
  }

  if (parsedRows.length === 0) {
    return { error: "Identifiquei as colunas, mas nenhuma linha tinha data e valor válidos ao mesmo tempo." };
  }
  return { rows: parsedRows };
}
