"use client";

import { useActionState } from "react";
import { adminLoginAction, type AdminLoginState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";

/**
 * Login dedicado do painel admin — de propósito NADA parecido com a tela de
 * login do cliente (`(auth)/login`): sem link de "criar conta", sem
 * "esqueci minha senha", sem copy de marketing. É um portão separado do
 * resto do produto, não uma variação dela.
 */
export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(adminLoginAction, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-brand-800 p-6 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.5)]">
        <h1 className="font-sans font-bold text-xl text-onbrand mb-1">Painel administrativo</h1>
        <p className="text-sm text-onbrand/55 mb-6">Acesso restrito à equipe Tobias.</p>

        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <FieldError>{state?.error}</FieldError>
          <Button type="submit" className="w-full" loading={pending}>
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
