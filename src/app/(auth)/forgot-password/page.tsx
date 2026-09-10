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

  const isLinkResult = state?.success?.startsWith("link:");
  const resetUrl = isLinkResult ? state!.success!.slice("link:".length) : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="font-serif text-2xl text-brand-950 mb-1">Redefinir senha</h1>
        <p className="text-sm text-ink-500 mb-6">
          Digite seu e-mail cadastrado para receber o link de redefinição.
        </p>

        {!resetUrl && (
          <form action={formAction} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <FieldError>{state?.error}</FieldError>
            <Button type="submit" className="w-full" loading={pending}>
              Enviar link
            </Button>
          </form>
        )}

        {resetUrl && (
          <div className="rounded-xl bg-gold-100 border border-gold-400/40 p-4 text-sm text-ink-700">
            <p className="mb-2">
              Ainda não temos um servidor de e-mail configurado nesta versão, então aqui está seu link
              de redefinição (válido por 1 hora):
            </p>
            <Link href={resetUrl} className="break-all text-brand-800 underline font-medium">
              {resetUrl}
            </Link>
          </div>
        )}

        <p className="mt-5 text-center text-sm text-ink-500">
          <Link href="/login" className="text-brand-800 font-medium hover:underline">
            Voltar para o login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
