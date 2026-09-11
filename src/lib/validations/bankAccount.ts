import { z } from "zod";

export const createBankAccountSchema = z.object({
  name: z.string().min(1, "Dê um nome para a conta"),
  bankName: z.string().optional().nullable(),
  type: z.enum(["CHECKING", "SAVINGS", "INVESTMENT", "WALLET"]),
  balance: z.number(),
});
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

export const updateBankAccountBalanceSchema = z.object({
  balance: z.number(),
});
