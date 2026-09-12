import "server-only";
import { generateText, generateJSON, generateVisionJSON, type ChatTurn as GeminiChatTurn } from "./generate";
import { ONBOARDING_SYSTEM, CHAT_SYSTEM, TOBIAS_PERSONA } from "./prompts";
import {
  onboardingTurnSchema,
  onboardingTurnJsonSchema,
  type OnboardingTurn,
  chatTurnSchema,
  chatTurnJsonSchema,
  type ChatTurn,
  receiptExtractionSchema,
  receiptExtractionJsonSchema,
  type ReceiptExtraction,
  statementExtractionSchema,
  statementExtractionJsonSchema,
  type StatementExtraction,
  classificationSchema,
  classificationJsonSchema,
  type Classification,
  affordabilitySchema,
  affordabilityJsonSchema,
  type AffordabilityResult,
} from "./schemas";
import { simulateRetirementCurve, type RetirementInputs } from "@/services/retirement";
import { isAIConfigured } from "./client";

export { isAIConfigured };

/**
 * AIService — the single decoupled entry point for every AI-backed
 * capability in the product (spec §29). Nothing else in the codebase talks
 * to Gemini directly. Internally this is "one Tobias" but the methods below
 * map to the internal specialist agents from the spec (Financial Analyst,
 * Budget Agent, Goal Agent, Retirement Agent, Spending Behavior Agent,
 * Research Agent, Document Agent) — they all share the same financial
 * context, they're just different prompts/schemas over the same model.
 */
export const AIService = {
  /** Onboarding Agent: one adaptive turn of the first conversation. */
  async onboardingTurn(
    financialContext: string,
    history: GeminiChatTurn[],
    userMessage: string
  ): Promise<OnboardingTurn> {
    return generateJSON({
      system: `${ONBOARDING_SYSTEM}\n\n## O QUE JÁ SABEMOS ATÉ AGORA\n${financialContext}`,
      history,
      message: userMessage,
      jsonSchema: onboardingTurnJsonSchema,
      zodSchema: onboardingTurnSchema,
    });
  },

  /** Financial Analyst Agent: main chat, grounded in the full financial context. */
  async chatTurn(financialContext: string, history: GeminiChatTurn[], userMessage: string): Promise<ChatTurn> {
    return generateJSON({
      system: `${CHAT_SYSTEM}\n\n## CONTEXTO FINANCEIRO\n${financialContext}`,
      history,
      message: userMessage,
      jsonSchema: chatTurnJsonSchema,
      zodSchema: chatTurnSchema,
    });
  },

  /** Document Agent: extracts structured data from a photographed receipt. */
  async extractReceipt(images: { mimeType: string; base64: string }[]): Promise<ReceiptExtraction> {
    return generateVisionJSON({
      system: `${TOBIAS_PERSONA}\n\nVocê está extraindo dados estruturados de uma nota fiscal ou comprovante fotografado. Se houver múltiplas fotos, consolide como UMA única compra. Nunca invente valores que não conseguir ler — se um campo estiver ilegível, retorne null nesse campo e reduza a confiança geral.`,
      message:
        "Extraia os dados desta nota fiscal/comprovante: estabelecimento, CNPJ (se visível), data, hora, forma de pagamento, itens (descrição, quantidade, preço unitário, preço total) e valor total. Retorne também uma confiança geral de 0 a 1.",
      images,
      jsonSchema: receiptExtractionJsonSchema,
      zodSchema: receiptExtractionSchema,
    });
  },

  /**
   * Document Agent: extracts every transaction from a bank statement or
   * credit card invoice (PDF or foto/print) as a batch, instead of the one
   * purchase `extractReceipt` reads. `kind` only changes the prompt framing
   * (whose money is moving) — the schema and confirmation flow are the same
   * either way.
   */
  async extractStatement(
    images: { mimeType: string; base64: string }[],
    kind: "BANK_STATEMENT" | "INVOICE_STATEMENT"
  ): Promise<StatementExtraction> {
    const framing =
      kind === "BANK_STATEMENT"
        ? "um extrato de conta bancária. Cada linha é um débito (dinheiro saindo, ex: compra no débito, Pix enviado, tarifa) ou crédito (dinheiro entrando, ex: salário, Pix recebido, estorno) na conta."
        : "uma fatura de cartão de crédito. Cada linha é uma compra feita no cartão (EXPENSE); um estorno/crédito na fatura é INCOME. Ignore a linha de 'pagamento da fatura anterior', ela não é uma compra.";

    return generateVisionJSON({
      system: `${TOBIAS_PERSONA}\n\nVocê está extraindo as transações de ${framing} Retorne TODAS as linhas de movimentação que conseguir ler, na ordem em que aparecem. Nunca invente uma transação que não está no documento, e nunca invente um número de parcela (ex: "2/12") que o documento não mostrar explicitamente — se não tiver certeza, deixe installmentNumber/installmentTotal como null. Se houver várias páginas/fotos, consolide como um único extrato contínuo, sem repetir transações que aparecem em mais de uma página.`,
      message:
        "Extraia todas as transações deste documento: data, descrição, valor, direção (EXPENSE/INCOME), categoria provável e número de parcela quando o documento mostrar isso. Retorne também o período coberto (primeira e última data) e uma confiança geral de 0 a 1.",
      images,
      jsonSchema: statementExtractionJsonSchema,
      zodSchema: statementExtractionSchema,
      // Um extrato/fatura real pode ter dezenas de linhas — 8192 tokens
      // truncava a resposta no meio do JSON antes de terminar de listar
      // tudo (visto em produção: um extrato de ~30 transações cortou a
      // string no meio). Bem mais folga aqui evita isso na grande maioria
      // dos casos; ainda pode truncar num extrato excepcionalmente longo,
      // mas não há como saber o tamanho antes de tentar.
      maxOutputTokens: 32768,
    });
  },

  /** Budget/Spending Behavior Agent: picks the best category for a transaction from the user's real category list. */
  async classifyTransaction(params: {
    description: string;
    merchant?: string | null;
    amount: number;
    categories: { id: string; name: string; type: string }[];
  }): Promise<Classification> {
    const categoryList = params.categories.map((c) => `${c.id}: ${c.name} (${c.type})`).join("\n");
    return generateJSON({
      system: `${TOBIAS_PERSONA}\n\nVocê classifica uma transação financeira em UMA das categorias existentes do usuário, listadas abaixo. Escolha o id exato. Se nada se encaixar bem, retorne categoryId null e sugira um categoryName novo.\n\nCategorias disponíveis:\n${categoryList}`,
      message: `Transação: "${params.description}"${params.merchant ? ` no estabelecimento "${params.merchant}"` : ""}, valor R$ ${params.amount.toFixed(2)}.`,
      jsonSchema: classificationJsonSchema,
      zodSchema: classificationSchema,
      temperature: 0.1,
    });
  },

  /** Spending Behavior Agent: turns already-computed facts into a plain-language insight. Never invents the numbers — they're passed in. */
  async generateInsight(financialContext: string, triggerFacts: string): Promise<string> {
    return generateText({
      system: `${TOBIAS_PERSONA}\n\nEscreva um insight curto (2-4 frases) conectando o fato observado ao plano financeiro da pessoa. Use APENAS os números fornecidos nos fatos abaixo — não invente nenhum outro número.\n\n## CONTEXTO\n${financialContext}`,
      message: `Fatos observados (calculados pelo sistema, não pela IA):\n${triggerFacts}\n\nEscreva o insight para o usuário.`,
      temperature: 0.5,
      maxOutputTokens: 300,
    });
  },

  /** Generates the narrative summary for FinancialPlan, grounded in the full context. */
  async generatePlanSummary(financialContext: string): Promise<string> {
    return generateText({
      system: `${TOBIAS_PERSONA}\n\nEscreva um resumo do plano financeiro da pessoa em até 6 frases: onde ela está, para onde está indo, e o que fazer a seguir. Use apenas os dados do contexto.`,
      message: `Contexto financeiro:\n${financialContext}\n\nEscreva o resumo do plano.`,
      temperature: 0.5,
      maxOutputTokens: 500,
    });
  },

  /**
   * Retirement Agent: the projection itself is pure deterministic math
   * (see services/retirement.ts) — never AI-generated. This method only asks
   * the model to phrase the comparison sentence a simulation button shows,
   * so numbers can never drift from what was actually computed.
   */
  async simulateRetirement(inputs: RetirementInputs, comparisonInputs?: RetirementInputs) {
    const base = simulateRetirementCurve(inputs);
    const comparison = comparisonInputs ? simulateRetirementCurve(comparisonInputs) : null;
    let narrative: string | null = null;
    if (comparison) {
      narrative = await generateText({
        system: `${TOBIAS_PERSONA}\n\nCompare os dois cenários de aposentadoria abaixo (já calculados matematicamente) em 1-2 frases diretas, sem inventar nenhum número novo.`,
        message: `Cenário atual: aporte ${inputs.monthlyContribution}, atinge a meta em ${base.base.yearsToTarget ?? "não atinge no horizonte"} anos.\nCenário simulado: aporte ${comparisonInputs!.monthlyContribution}, atinge a meta em ${comparison.base.yearsToTarget ?? "não atinge no horizonte"} anos.`,
        temperature: 0.4,
        maxOutputTokens: 200,
      });
    }
    return { base, comparison, narrative };
  },

  /** Research Agent: uses Gemini's web-grounding tool. Always labels itself when it cannot verify something live. */
  async researchWeb(query: string): Promise<{ summary: string; groundedAnswer: boolean }> {
    const summary = await generateText({
      system: `${TOBIAS_PERSONA}\n\nVocê é o agente de pesquisa do Tobias. Responda à pergunta com a pesquisa na web quando disponível. Se não conseguir confirmar um valor com uma busca real, diga explicitamente que é uma estimativa baseada em conhecimento geral, não em uma busca ao vivo, e nunca apresente um número específico como fato confirmado sem indicar a fonte. Sempre que possível, cite de onde veio a informação.`,
      message: query,
      grounding: true,
      temperature: 0.3,
      maxOutputTokens: 600,
    });
    return { summary, groundedAnswer: /fonte|segundo|de acordo com|http/i.test(summary) };
  },

  /** Decision Agent: "Posso comprar?" */
  async checkAffordability(financialContext: string, purchaseDescription: string, amount: number): Promise<AffordabilityResult> {
    return generateJSON({
      system: `${TOBIAS_PERSONA}\n\nVocê analisa se uma compra hipotética cabe no plano financeiro da pessoa. Considere renda, patrimônio, dívidas, reserva de emergência, objetivos ativos e o plano de aposentadoria do contexto abaixo. Nunca diga apenas "sim" ou "não" sem explicar a consequência concreta.\n\n## CONTEXTO FINANCEIRO\n${financialContext}`,
      message: `A pessoa está considerando: "${purchaseDescription}", no valor de R$ ${amount.toFixed(2)}. Ela pode comprar isso sem comprometer o plano?`,
      jsonSchema: affordabilityJsonSchema,
      zodSchema: affordabilitySchema,
      temperature: 0.3,
    });
  },
};
