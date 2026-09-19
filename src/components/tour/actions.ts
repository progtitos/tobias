"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { trackEvent } from "@/services/analytics";

/**
 * Marca o guia de primeiro acesso como concluído (ou pulado). Chamada tanto
 * no botão "Concluir" do último passo quanto em "Pular" — em ambos os casos
 * o usuário não deve ver o guia de novo, então o campo é o mesmo; o evento
 * de analytics é o que distingue quem terminou de quem pulou.
 */
export async function completeTourAction(skipped: boolean) {
  const user = await requireUser();
  await db.update(users).set({ tourCompleted: true }).where(eq(users.id, user.id));
  await trackEvent(user.id, skipped ? "tour_skipped" : "tour_completed", {});
}
