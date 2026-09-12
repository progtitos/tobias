/**
 * Soma meses a uma data sem o overflow silencioso de `Date#setMonth` — por
 * exemplo, 31/01 + 1 mês vira 28/02 (ou 29 em ano bissexto), nunca 03/03.
 * `Date#setMonth` estoura porque ele soma o mês primeiro e só depois
 * normaliza o dia: fevereiro não tem dia 31, então o excedente "vaza" pro
 * mês seguinte. Usado nas parcelas (services/transactions.ts) — sem isso,
 * uma compra parcelada feita no dia 29/30/31 pulava ou duplicava meses.
 */
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
