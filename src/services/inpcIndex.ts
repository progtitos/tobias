/**
 * Correção monetária pelo INPC, usada só para trazer os salários de
 * contribuição do histórico do CNIS (ver `cnisImport.ts`) para valores de
 * hoje, antes de calcular a média real do benefício do INSS
 * (`computeAverageSalaryFromHistory` em `inss.ts`).
 *
 * ==========================================================================
 * AVISO DE ESCOPO — leia antes de mexer aqui (mesmo espírito do aviso no
 * topo de inss.ts: número aproximado, documentado, nunca escondido)
 * ==========================================================================
 * A lei manda corrigir MÊS A MÊS desde julho/1994 (Lei 8.213, art. 29-A).
 * Esta tabela usa o percentual ACUMULADO NO ANO (um número por ano, não por
 * mês) — construir e manter uma série de ~380 índices mensais desde 1994
 * ficaria pesado demais pra manter atualizado todo mês, então a aproximação
 * aqui é: todo salário de um mesmo ano corrige pelo mesmo fator (o produto
 * dos percentuais anuais de TODOS os anos seguintes até o último ano
 * fechado). Isso tende a SUBESTIMAR levemente a correção de competências no
 * início do ano (ex.: um salário de janeiro "deveria" corrigir um pouco mais
 * que um de dezembro do mesmo ano, mas aqui os dois recebem o mesmo fator) —
 * erro pequeno frente à precisão que este produto já se propõe (estimativa,
 * não um cálculo oficial do INSS).
 *
 * Competências de 1994: a série de fontes públicas consultadas mistura, no
 * total do ano, os meses de hiperinflação anteriores ao Plano Real
 * (jul/1994) com os posteriores — não há um número isolado e confiável só
 * de jul-dez/1994. Como aproximação conservadora (e documentada), qualquer
 * competência de 1994 usa o mesmo fator de 1995 (ou seja, é tratada como se
 * já estivesse no nível de preços de jan/1995) — na prática, subestima um
 * pouco a correção desses meses mais antigos, o que é aceitável dado que
 * pesam pouco numa média de dezenas de anos de contribuição.
 *
 * Competências fora da tabela (ano atual em andamento, ou anterior a 1994):
 * usam fator 1 (sem correção) se forem mais recentes que o último ano
 * fechado, já que a defasagem é de poucos meses; e são simplesmente
 * ignoradas se forem anteriores a jul/1994 (ver `isCompetenciaElegivel`).
 *
 * Fontes consultadas (setembro/2026), série 2000-2025 conferida em duas
 * fontes independentes e batendo:
 * - https://www.dadosdemercado.com.br/indices/inpc
 * - https://www.idinheiro.com.br/tabelas/tabela-inpc/ (única fonte com
 *   1994-1999 isolados)
 *
 * QUANDO ATUALIZAR: todo início de ano, incluir o percentual acumulado do
 * ano que acabou de fechar e mover `ULTIMO_ANO_FECHADO`. Mesma cadência de
 * manutenção que TETO_INSS_2026/PISO_INSS_2026 em inss.ts.
 */

/** Percentual de variação ACUMULADA NO ANO do INPC (IBGE), ano a ano. */
const INPC_ACUMULADO_ANO: Record<number, number> = {
  1995: 21.98,
  1996: 9.12,
  1997: 4.34,
  1998: 2.49,
  1999: 8.43,
  2000: 5.27,
  2001: 9.44,
  2002: 14.74,
  2003: 10.38,
  2004: 6.13,
  2005: 5.05,
  2006: 2.81,
  2007: 5.16,
  2008: 6.48,
  2009: 4.11,
  2010: 6.47,
  2011: 6.08,
  2012: 6.2,
  2013: 5.56,
  2014: 6.23,
  2015: 11.28,
  2016: 6.58,
  2017: 2.07,
  2018: 3.43,
  2019: 4.48,
  2020: 5.45,
  2021: 10.16,
  2022: 5.93,
  2023: 3.71,
  2024: 4.77,
  2025: 3.9,
};

/** Último ano com o INPC acumulado já fechado e disponível na tabela acima. */
export const ULTIMO_ANO_FECHADO = 2025;

/** Lei 8.213/1991, art. 29-A: a média só considera competências a partir de julho/1994 (Plano Real). */
const PRIMEIRA_COMPETENCIA_VALIDA = new Date(Date.UTC(1994, 6, 1)); // jul/1994

export function isCompetenciaElegivel(competencia: Date): boolean {
  return competencia.getTime() >= PRIMEIRA_COMPETENCIA_VALIDA.getTime();
}

/**
 * Fator multiplicativo pra trazer um valor do ano `ano` para o valor
 * equivalente em "hoje" (nível de preços do fim de `ULTIMO_ANO_FECHADO`) —
 * ver aviso de escopo acima sobre a granularidade anual e o tratamento de
 * 1994.
 */
export function fatorCorrecaoInpc(ano: number): number {
  const anoEfetivo = Math.max(1995, ano); // 1994 usa o mesmo fator de 1995
  let fator = 1;
  for (let y = anoEfetivo + 1; y <= ULTIMO_ANO_FECHADO; y++) {
    const pct = INPC_ACUMULADO_ANO[y];
    if (pct != null) fator *= 1 + pct / 100;
  }
  return fator;
}

/** Corrige um valor de uma competência específica para o nível de preços de hoje. */
export function corrigirPeloInpc(valor: number, competencia: Date): number {
  return valor * fatorCorrecaoInpc(competencia.getUTCFullYear());
}
