"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(signupAction, undefined);

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="font-sans font-bold text-2xl text-cream-50 mb-1">Criar sua conta</h1>
        <p className="text-sm text-cream-50/55 mb-6">15 dias grátis, sem cartão de crédito.</p>

        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" name="name" autoComplete="name" placeholder="Seu nome" required />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
            />
          </div>
          <FieldError>{state?.error}</FieldError>
          <Button type="submit" className="w-full" loading={pending} variant="secondary">
            Criar conta e começar
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-cream-50/40">
          Ao criar sua conta, você concorda com os{" "}
          <Link href="/legal/termos" className="underline hover:text-cream-50/70">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/legal/privacidade" className="underline hover:text-cream-50/70">
            Política de Privacidade
          </Link>{" "}
          do Tobias.
        </p>

        <p className="mt-4 text-center text-sm text-cream-50/55">
          Já tem conta?{" "}
          <Link href="/login" className="text-gold-400 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
