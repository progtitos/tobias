"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createAdminSession, destroyAdminSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth";

export type AdminLoginState = { error?: string } | undefined;

/**
 * Login do painel admin — separado de `loginAction` (login do cliente) de
 * propósito: mesma tabela `users`/mesma senha, mas sessão própria
 * (`createAdminSession`, cookie `tobias_admin_session`) e uma checagem a mais
 * que o login comum não faz, `role !== "ADMIN"`. O erro é sempre o mesmo
 * texto genérico nos três casos (e-mail não existe, senha errada, conta
 * existe mas não é staff) — não dá pra alguém testando e-mails descobrir por
 * tentativa e erro quem tem acesso admin.
 */
export async function adminLoginAction(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Credenciais inválidas." };
  }
  const { email, password } = parsed.data;

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !user.passwordHash || user.deletedAt || user.role !== "ADMIN") {
    return { error: "Credenciais inválidas." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Credenciais inválidas." };
  }

  await createAdminSession(user.id);
  redirect("/admin");
}

export async function adminLogoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}
