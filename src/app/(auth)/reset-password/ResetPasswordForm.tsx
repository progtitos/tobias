"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPasswordAction, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    resetPasswordAction,
    undefined
  );

  if (!token) {
    return (
      <p className="text-sm text-ink-500">
        Link inválido.{" "}
        <Link href="/forgot-password" className="text-brand-800 underline">
          Solicite um novo
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <Label htmlFor="password">Nova senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" className="w-full" loading={pending}>
        Redefinir senha
      </Button>
    </form>
  );
}
