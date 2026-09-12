import { z } from "zod";

export const createCreditCardSchema = z.object({
  bankAccountId: z.string().min(1, "Selecione a conta que paga a fatura"),
  nickname: z.string().min(1, "Dê um nome para o cartão"),
  brand: z.string().optional().nullable(),
  lastFourDigits: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || /^\d{4}$/.test(v), "Use os 4 últimos dígitos do cartão"),
  limitAmount: z.number().positive().optional().nullable(),
  closingDay: z.number().int().min(1).max(31).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
});
export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
