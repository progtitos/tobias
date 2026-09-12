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
