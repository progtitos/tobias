import { z } from "zod";

export const createInvestmentSchema = z.object({
  name: z.string().min(1, "Dê um nome para o investimento"),
  type: z.enum(["FIXED_INCOME", "FUNDS", "STOCKS", "ETF", "REIT", "PENSION", "TREASURY", "OTHER"]),
  investedAmount: z.number().min(0),
  currentAmount: z.number().min(0),
  liquidity: z.string().optional().nullable(),
  institution: z.string().optional().nullable(),
  goalId: z.string().optional().nullable(),
});
export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;

export const updateInvestmentValueSchema = z.object({
  currentAmount: z.number().min(0),
});

export const investmentContributionSchema = z.object({
  amount: z.number().positive("O valor precisa ser maior que zero"),
});
