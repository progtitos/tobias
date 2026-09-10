import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="font-serif text-2xl text-brand-950 mb-1">Nova senha</h1>
        <p className="text-sm text-ink-500 mb-6">Escolha uma nova senha para sua conta.</p>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
