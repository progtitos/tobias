import { z } from "zod";

// "Data para conquista" virou obrigatória (redesenho aprovado, 02/10/2026):
// a tela "Futuro" (ex-"Curva de aposentadoria") agora plota cada objetivo
// como um ícone em (idade do prazo, valor que custa) na mesma curva do
// patrimônio — sem prazo não tem onde plotar o ícone, e o objetivo some do
// "liga os pontos" sem nenhum aviso. Reserva de emergência fica de fora
// dessa exigência: não é uma "conquista" com data, é um colchão contínuo
// (ver EMERGENCY_FUND em todo o resto do app — tanque próprio, sem prazo).
export const createGoalSchema = z
  .object({
    title: z.string().min(1, "Dê um nome para o seu objetivo."),
    type: z.enum(["DREAM", "EMERGENCY_FUND", "PROPERTY", "RETIREMENT", "CUSTOM"]),
    targetAmount: z.number().positive().optional(),
    targetDate: z.string().optional(),
    monthlyContribution: z.number().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "EMERGENCY_FUND") return;
    if (!data.targetAmount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetAmount"], message: "Quanto custa esse objetivo?" });
    }
    if (!data.targetDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetDate"], message: "Pra quando é essa conquista?" });
    }
  });
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
