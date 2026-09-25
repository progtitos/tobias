"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    requestPasswordResetAction,
    undefined
  );

  // SEGURANÇA (corrigido 25/09/2026): esta tela chegou a renderizar o link de
  // redefinição de senha em texto claro pra quem preenchesse o formulário,
  // sem nenhuma verificação de que a pessoa é dona daquele e-mail — ver o
  // comentário em requestPasswordResetAction (src/lib/auth/actions.ts) pro
  // histórico completo. Agora a action nunca devolve o link, só uma
  // mensagem genérica (mesmo texto tanto pra e-mail existente quanto
  // inexistente, pra não revelar quais e-mails estão cadastrados).

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Redefinir senha</h1>
        <p className="text-sm text-onbrand/55 mb-6">
          Digite seu e-mail cadastrado para receber o link de redefinição.
        </p>

        {!state?.success && (
          <form action={formAction} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <FieldError>{state?.error}</FieldError>
            <Button type="submit" className="w-full" loading={pending} variant="secondary">
              Enviar link
            </Button>
          </form>
        )}

        {state?.success && (
          <div className="rounded-xl bg-brand-900 border border-gold-400/30 p-4 text-sm text-onbrand/80">
            {state.success}
          </div>
        )}

        <p className="mt-5 text-center text-sm text-onbrand/55">
          <Link href="/login" className="text-gold-400 font-medium hover:underline">
            Voltar para o login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
