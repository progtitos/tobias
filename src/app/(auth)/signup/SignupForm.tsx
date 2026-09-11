"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signupAction, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { PRICING_PLANS, type BillingCycle } from "@/lib/billing/plans";
import { cn } from "@/lib/utils/cn";

function isBillingCycle(value: string | null): value is BillingCycle {
  return PRICING_PLANS.some((p) => p.cycle === value);
}

export function SignupForm() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("plano");
  const [cycle, setCycle] = useState<BillingCycle>(isBillingCycle(requested) ? requested : "SEMESTRAL");
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(signupAction, undefined);

  return (
    <>
      <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Criar sua conta</h1>
      <p className="text-sm text-onbrand/55 mb-6">
        15 dias grátis. Cadastre um cartão para liberar o teste, nada é cobrado agora.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {PRICING_PLANS.map((plan) => (
          <button
            key={plan.cycle}
            type="button"
            onClick={() => setCycle(plan.cycle)}
            className={cn(
              "rounded-xl border px-2 py-2.5 text-center transition-colors",
              cycle === plan.cycle ? "border-gold-400 bg-gold-400/10" : "border-white/10 hover:border-white/25"
            )}
          >
            <p className={cn("text-xs font-medium", cycle === plan.cycle ? "text-gold-400" : "text-onbrand/70")}>
              {plan.label}
            </p>
            <p className="text-[13px] font-medium text-onbrand tabular-nums mt-0.5">{plan.monthlyEquivalentLabel}</p>
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="cycle" value={cycle} />
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
          Continuar para o pagamento
        </Button>
        <p className="text-center text-xs text-onbrand/40">
          Você será redirecionado ao Mercado Pago para cadastrar o cartão com segurança.
        </p>
      </form>

      <p className="mt-5 text-center text-xs text-onbrand/40">
        Ao criar sua conta, você concorda com os{" "}
        <Link href="/legal/termos" className="underline hover:text-onbrand/70">
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link href="/legal/privacidade" className="underline hover:text-onbrand/70">
          Política de Privacidade
        </Link>{" "}
        do Tobias.
      </p>

      <p className="mt-4 text-center text-sm text-onbrand/55">
        Já tem conta?{" "}
        <Link href="/login" className="text-gold-400 font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
