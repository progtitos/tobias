import { z } from "zod";

export const createTransactionSchema = z.object({
  date: z.string().min(1, "Informe a data"),
  amount: z.number().positive("O valor precisa ser maior que zero"),
  type: z.enum(["INCOME", "EXPENSE", "INVESTMENT_CONTRIBUTION", "TRANSFER"]),
  categoryId: z.string().optional().nullable(),
  description: z.string().min(1, "Descreva o gasto"),
  merchant: z.string().optional().nullable(),
  paymentMethod: z
    .enum(["CASH", "DEBIT_CARD", "CREDIT_CARD", "PIX", "BANK_TRANSFER", "BOLETO", "OTHER"])
    .optional()
    .nullable(),
  installmentTotal: z.number().int().min(1).max(48).optional(),
  notes: z.string().optional().nullable(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
