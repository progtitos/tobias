// Conteúdo do guia obrigatório de primeiro acesso — separado do componente
// pra ficar fácil ajustar o texto/ordem sem mexer na lógica de overlay.
// Cada `target` casa com um atributo `data-tour="<target>"` em algum lugar
// da UI real (ver AppShell.tsx e dashboard/page.tsx) — o passo aponta pro
// elemento de verdade, não pra uma cópia dele numa tela separada.
export type TourStep = {
  target: string;
  title: string;
  body: string;
  /** Onde encostar o cartão do passo em relação ao elemento — "auto" deixa
   *  o componente decidir pela posição do alvo na tela. */
  placement?: "right" | "bottom" | "auto";
};

export const TOUR_STEPS: TourStep[] = [
  {
    target: "dashboard-resumo",
    title: "Seu resumo do mês",
    body: "Toda vez que você abrir o Tobias, é isso que aparece primeiro: saldo do mês, quanto já entrou e saiu, e o cartão que precisa de mais atenção.",
    placement: "bottom",
  },
  {
    target: "dashboard-ponteiro",
    title: "O Ponteiro",
    body: "Uma nota de 0 a 100 pra sua vida financeira inteira, somando 9 dimensões — controle de gastos, patrimônio, objetivos e mais. É o primeiro lugar pra saber onde focar.",
    placement: "bottom",
  },
  {
    target: "nav-conta",
    title: "Conecte suas contas de verdade",
    body: "Aqui você cadastra contas bancárias e cartões de verdade. Quanto mais completo, mais precisas ficam as contas e projeções do Tobias.",
    placement: "right",
  },
  {
    target: "nav-lancamentos",
    title: "Registre suas transações",
    body: "Toda vez que você gastar ou receber algo, é aqui que entra. É o que alimenta o orçamento, as categorias automáticas e o Ponteiro.",
    placement: "right",
  },
  {
    target: "nav-retirement",
    title: "Sua curva de aposentadoria",
    body: "Uma projeção do seu patrimônio total em 3 cenários de retorno, pra acompanhar se você está no caminho certo — não é uma recomendação de investimento, é o seu norte.",
    placement: "right",
  },
];
