// Conteúdo do guia obrigatório de primeiro acesso, separado do componente
// pra ficar fácil ajustar o texto/ordem sem mexer na lógica de overlay.
// Cada `target` casa com um atributo `data-tour="<target>"` em algum lugar
// da UI real: o passo aponta pro elemento de verdade, não pra uma cópia dele
// numa tela separada.
//
// Reescrito em 2026-09-24 a pedido do Thiago ("o guia tour tem que passar
// por cada detalhe do sistema explicando como funciona"): a versão anterior
// tinha só 5 passos, todos presos ao Dashboard, e 3 deles só apontavam pra
// um item do menu sem nunca abrir a tela e explicar o que tem dentro. Agora
// cada passo carrega sua própria `route`, e o overlay (MandatoryTourOverlay)
// navega de verdade pra lá antes de medir o alvo, então o tour percorre as
// páginas reais na mesma ordem do menu lateral: Início, Tobias, Transações,
// Conta, Renda e Despesas, Patrimônio, Investimentos, Aposentadoria e, por
// fim, o Ponteiro completo (Compass, que não tem aba própria no menu).
export type TourStep = {
  target: string;
  title: string;
  body: string;
  /** Onde encostar o cartão do passo em relação ao elemento. "auto" deixa
   *  o componente decidir pela posição do alvo na tela. */
  placement?: "right" | "bottom" | "auto";
  /** Rota onde esse `target` existe de verdade. Se omitida, assume
   *  "/dashboard" (mantém o comportamento antigo pros passos que ainda
   *  vivem lá). */
  route?: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    target: "dashboard-resumo",
    title: "Seu resumo do mês",
    body: "Toda vez que você abrir o Tobias, é isso que aparece primeiro: saldo do mês, quanto já entrou e saiu, e o cartão que precisa de mais atenção.",
    placement: "bottom",
    route: "/dashboard",
  },
  {
    target: "dashboard-ponteiro",
    title: "O Ponteiro",
    body: "Uma nota de 0 a 100 pra sua vida financeira inteira, somando 9 dimensões: controle de gastos, patrimônio, objetivos e mais. É o primeiro lugar pra saber onde focar. Já já a gente vê ele por inteiro.",
    placement: "bottom",
    route: "/dashboard",
  },
  {
    target: "chat-tobias",
    title: "Converse com o Tobias",
    body: "Aqui você conta o que aconteceu (\"gastei 80 reais no mercado\", \"recebi o salário\") em texto ou foto de nota fiscal, e o Tobias lança sozinho. Também é onde ele te avisa quando algo pede atenção.",
    placement: "bottom",
    route: "/chat",
  },
  {
    target: "lancamentos-lista",
    title: "Suas transações, mês a mês",
    body: "Tudo que entra e sai fica aqui, organizado por categoria, com orçamento por categoria na aba ao lado. É o que alimenta o Ponteiro e as projeções do Tobias.",
    placement: "bottom",
    route: "/lancamentos",
  },
  {
    target: "conta-resumo",
    title: "Suas contas e cartões",
    body: "Cadastre contas bancárias, carteiras digitais e cartões de crédito de verdade aqui. Quanto mais completo, mais precisos ficam os cálculos do Tobias em qualquer outra tela.",
    placement: "bottom",
    route: "/conta",
  },
  {
    target: "renda-despesas-resumo",
    title: "Renda e gastos fixos",
    body: "Cadastre salário e gastos fixos obrigatórios (aluguel, pensão) uma vez só: todo mês o Tobias já lança sozinho, você só confirma ou ajusta o valor.",
    placement: "bottom",
    route: "/renda-despesas",
  },
  {
    target: "patrimonio-liquido",
    title: "Seu patrimônio líquido",
    body: "A soma de tudo que você tem (contas, investimentos, outros bens) menos o que você deve. Cadastre um carro, um imóvel quitado ou uma dívida logo abaixo pra esse número refletir sua vida financeira real, não só o dinheiro que passa pela conta.",
    placement: "bottom",
    route: "/patrimonio",
  },
  {
    target: "patrimonio-sonhos",
    title: "Seus objetivos e sua reserva",
    body: "Cada sonho, imóvel ou reserva de emergência vira um cartão com progresso visual e o ritmo mensal necessário pra chegar lá no prazo. A reserva de emergência é automática: ela puxa o saldo guardado sozinha.",
    placement: "bottom",
    route: "/patrimonio",
  },
  {
    target: "investimentos-resumo",
    title: "Seus investimentos",
    body: "Um raio-x visual do que você tem investido: por tipo (renda fixa, ações, fundos...) e por objetivo ligado. Editar valores e registrar aportes é sempre aqui.",
    placement: "bottom",
    route: "/investimentos",
  },
  {
    target: "retirement-curva",
    title: "Sua curva de aposentadoria",
    body: "Uma projeção do seu patrimônio total em 3 cenários de retorno, pra acompanhar se você está no caminho certo pra se aposentar como planejou. Não é uma recomendação de investimento, é o seu norte.",
    placement: "bottom",
    route: "/retirement",
  },
  {
    target: "compass-pontuacao",
    title: "O Ponteiro por inteiro",
    body: "Aqui está a nota geral e as 9 dimensões que a formam, cada uma com diagnóstico e o próximo passo sugerido. Vale voltar aqui de vez em quando pra ver onde focar.",
    placement: "bottom",
    route: "/compass",
  },
];
