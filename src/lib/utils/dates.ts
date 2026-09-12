/**
 * Data/hora "agora" ancorada no fuso do Brasil (America/Sao_Paulo, UTC-3 o
 * ano todo, sem horário de verão desde 2019), em vez do fuso do processo
 * Node — que em produção (Vercel) roda em UTC. O produto é só pro Brasil,
 * então "hoje"/"mês atual" tem que refletir o calendário de quem usa, não
 * o do servidor.
 *
 * Sem isso, todo fim de mês tinha uma janela de ~3h (21h–23h59 no horário
 * de Brasília, já virou o dia seguinte em UTC) em que o servidor achava que
 * já era o mês seguinte — transações lançadas ou visualizadas nesse horário
 * caíam no mês errado (ex: algo lançado ainda no dia 31/08 às 22h aparecia
 * em setembro). Usa `Intl` com timeZone explícito em vez de um offset fixo
 * "-3h" pra não quebrar se o Brasil voltar a adotar horário de verão.
 */
export function nowInBrazil(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

/**
 * Converte uma data "sem hora" (string "YYYY-MM-DD", vinda de um
 * `<input type="date">`, de uma leitura de extrato/fatura por IA ou do CSV)
 * num `Date` de um jeito que sobrevive a fuso horário.
 *
 * Bug que isso evita: `new Date("2026-07-01")` (o que o código fazia antes)
 * é interpretado como meia-noite em UTC. Ao exibir de volta no navegador de
 * alguém no Brasil (UTC-3) com `toLocaleDateString`, meia-noite UTC vira
 * 21h do dia ANTERIOR no horário local — a data mostrada (e o mês em que a
 * transação cai num agrupamento por mês) fica um dia pra trás do que a
 * pessoa digitou ou do que o extrato mostrava. Ficou visível demais numa
 * importação de extrato com dezenas de linhas (algumas "viravam" o mês
 * anterior), mas o mesmo bug já existia silenciosamente em qualquer
 * transação lançada manualmente.
 *
 * Fixando ao meio-dia UTC em vez de meia-noite, a data mostrada continua
 * correta em qualquer fuso horário razoável (o Brasil todo fica entre
 * UTC-5 e UTC-2) — meio-dia UTC nunca cruza pra outro dia calendário nessa
 * faixa. Não corrige dados já salvos antes desta função existir, só as
 * novas escritas a partir de agora.
 */
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

/**
 * Soma meses a uma data sem o overflow silencioso de `Date#setMonth` — por
 * exemplo, 31/01 + 1 mês vira 28/02 (ou 29 em ano bissexto), nunca 03/03.
 * `Date#setMonth` estoura porque ele soma o mês primeiro e só depois
 * normaliza o dia: fevereiro não tem dia 31, então o excedente "vaza" pro
 * mês seguinte. Usado nas parcelas (services/transactions.ts) — sem isso,
 * uma compra parcelada feita no dia 29/30/31 pulava ou duplicava meses.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  // Dia 1 nunca estoura (todo mês tem um dia 1), então isto já cai no mês
  // certo — inclusive quando `months` é negativo ou cruza anos, já que o
  // próprio JS normaliza mês fora de 0-11 ajustando o ano.
  const firstOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTargetMonth = new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth() + 1,
    0
  ).getDate();

  const result = new Date(date);
  result.setFullYear(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth(), Math.min(day, lastDayOfTargetMonth));
  return result;
}
