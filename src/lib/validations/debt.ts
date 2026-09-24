import { z } from "zod";

// Antes desta tela, a única forma de uma dívida entrar no sistema era via
// extração de IA durante a conversa de onboarding (services/onboarding.ts,
// campo `newDebt`) — um insert único, sem service, sem action, sem UI. Depois
// do onboarding não tinha como cadastrar uma dívida nova, editar o saldo
// devedor conforme ia pagando, nem quitar. `debts.remainingAmount` ficava
// congelado, puxando o patrimônio líquido pra baixo pra sempre.
export const createDebtSchema = z.object({
  description: z.string().min(1, "Descreva a dívida"),
  type: z.enum(["CREDIT_CARD", "PERSONAL_LOAN", "FINANCING", "OVERDRAFT", "FAMILY_FRIENDS", "OTHER"]),
  totalAmount: z.number().min(0),
  remainingAmount: z.number().min(0),
  interestRateMonthly: z.number().min(0).optional().nullable(),
  installmentAmount: z.number().min(0).optional().nullable(),
  installmentsRemaining: z.number().int().min(0).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
});
export type CreateDebtInput = z.infer<typeof createDebtSchema>;

export const updateDebtRemainingSchema = z.object({
  remainingAmount: z.number().min(0),
});
