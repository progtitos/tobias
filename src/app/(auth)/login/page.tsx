"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(loginAction, undefined);

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Bem-vindo de volta</h1>
        <p className="text-sm text-onbrand/55 mb-6">Entre para continuar seu plano.</p>

        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link href="/forgot-password" className="text-xs text-gold-400 hover:underline mb-1.5">
                Esqueci minha senha
              </Link>
            </div>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <FieldError>{state?.error}</FieldError>
          <Button type="submit" className="w-full" loading={pending} variant="secondary">
            Entrar
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-onbrand/55">
          Ainda não tem conta?{" "}
          <Link href="/signup" className="text-gold-400 font-medium hover:underline">
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
