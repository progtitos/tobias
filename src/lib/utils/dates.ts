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
 * Normaliza formatos comuns de data pra "YYYY-MM-DD" antes de validar. A
 * extração de extrato/fatura por IA (`schemas.ts`) pede "ISO 8601 date" no
 * schema, mas isso é só uma descrição pro modelo, não uma garantia — um
 * extrato brasileiro mostra a data na tela como "05/03/2026" (DD/MM/AAAA), e
 * o modelo às vezes copia esse formato ao pé da letra em vez de converter.
 *
 * Bug de produção que motivou isso (2026-09-20, no dia seguinte ao fix
 * anterior): sem essa normalização, um extrato inteiro caía no "nenhuma data
 * veio num formato reconhecível" — não porque os dados estivessem
 * corrompidos, mas porque vieram num formato válido só que diferente do
 * único que `parseDateOnly` aceitava. Como o produto é só pro Brasil,
 * assume-se DD/MM/AAAA (nunca MM/DD/AAAA) quando o formato não é ISO.
 */
function normalizeDateFormats(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;

  // DD/MM/AAAA ou DD-MM-AAAA
  const brFull = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(dateStr);
  if (brFull) {
    const [, d, m, y] = brFull;
    return `${y}-${m}-${d}`;
  }

  // DD/MM/AA ou DD-MM-AA (assume 20AA — não faz sentido um extrato do
  // século passado neste produto)
  const brShort = /^(\d{2})[/-](\d{2})[/-](\d{2})$/.exec(dateStr);
  if (brShort) {
    const [, d, m, y] = brShort;
    return `20${y}-${m}-${d}`;
  }

  return dateStr;
}

/**
 * Converte uma data "sem hora" (string "YYYY-MM-DD" ou um formato BR comum,
 * vinda de um `<input type="date">`, de uma leitura de extrato/fatura por IA
 * ou do CSV) num `Date` de um jeito que sobrevive a fuso horário.
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
 *
 * Lança um erro claro (em vez de devolver silenciosamente um `Invalid Date`)
 * quando `dateStr` não é mesmo uma data válida em nenhum formato conhecido.
 * Bug de produção que motivou essa validação (2026-09-20): a leitura de um
 * extrato por IA devolveu uma data que não batia com o formato esperado pra
 * uma linha; o `Invalid Date` resultante só estourava várias camadas depois,
 * na hora de gravar no banco (`RangeError: Invalid time value` dentro do
 * driver do Postgres), como um erro genérico de servidor sem nenhuma
 * mensagem útil pro usuário. Validando aqui, quem chama pode decidir
 * descartar só a linha ruim (ver `parseDateOnlyOrNull`) em vez de derrubar a
 * importação inteira sem explicação.
 */
export function parseDateOnly(dateStr: string): Date {
  const normalized = normalizeDateFormats(dateStr ?? "");
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
  if (!match) throw new Error(`Data inválida: "${dateStr}"`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // `Date.UTC` normaliza silenciosamente um dia/mês impossível (ex.: 31 de
  // fevereiro vira 2 ou 3 de março) em vez de sinalizar erro — conferindo os
  // componentes de volta, pegamos esse caso também, não só string
  // completamente fora do formato.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`Data inválida (dia/mês/ano incoerentes): "${dateStr}"`);
  }
  return date;
}

/** Mesma coisa que `parseDateOnly`, mas devolve `null` em vez de lançar erro — para os casos em que uma data ruim deve ser ignorada, não derrubar a operação inteira. */
export function parseDateOnlyOrNull(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    return parseDateOnly(dateStr);
  } catch {
    return null;
  }
}

/**
 * Soma meses a uma data sem o overflow silencioso de `Date#setMonth` — por
 * exemplo, 31/01 + 1 mês vira 28/02 (ou 29 em ano bissexto), nunca 03/03.
 * `Date#setMonth` estoura porque ele soma o mês primeiro e só depois
 * normaliza o dia: fevereiro não tem dia 31, então o excedente "vaza" pro
 * mês seguinte. Usado nas parcelas (services/transactions.ts) — sem isso,
 * uma compra parcelada feita no dia 29/30/31 pulava ou duplicava meses.
 */
/**
 * Diferença entre duas datas em anos fracionários (365.25 dias/ano, o que
 * já embute o ano bissexto médio — precisão de dias não importa aqui, só
 * ordens de grandeza de meses/anos). Usado para idade e tempo de
 * contribuição projetados no simulador de INSS (`services/inss.ts`): a
 * regra de pontos e a de idade progressiva exigem meses, não só anos
 * inteiros, e truncar cedo demais faz alguém "perder" elegibilidade por
 * arredondamento.
 */
export function yearsBetween(from: Date, to: Date): number {
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
  return (to.getTime() - from.getTime()) / MS_PER_YEAR;
}

/**
 * Idade fracionária de alguém nascido em `birthDate`, na data `atDate`
 * (padrão: agora). Ex.: 34.5 = 34 anos e meio — a parte fracionária é o
 * que permite comparar contra limites como "59 anos e 6 meses" sem
 * converter tudo pra meses à mão em cada callsite.
 */
export function ageFromBirthDate(birthDate: Date, atDate: Date = new Date()): number {
  return yearsBetween(birthDate, atDate);
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
