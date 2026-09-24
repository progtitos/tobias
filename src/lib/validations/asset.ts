import { z } from "zod";

// "Outros bens" — carro, imóvel quitado, joias etc. Criado em 2026-09-20
// porque `computeNetWorth` (services/aggregations.ts) já somava
// `assets.estimatedValue` no patrimônio líquido, mas não existia NENHUM jeito
// de cadastrar um bem: a tabela e a leitura existiam, a escrita não. Era
// exatamente por isso que "Outros bens" sempre aparecia zerado e o
// patrimônio líquido parecia só saldo em conta menos dívida (Thiago: "isso
// daí não passa de um fluxo de caixa que entra e sai").
export const createAssetSchema = z.object({
  name: z.string().min(1, "Dê um nome para o bem"),
  type: z.enum(["REAL_ESTATE", "VEHICLE", "OTHER"]),
  estimatedValue: z.number().min(0),
  acquiredAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const updateAssetValueSchema = z.object({
  estimatedValue: z.number().min(0),
});
