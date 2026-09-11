import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Nova senha</h1>
        <p className="text-sm text-onbrand/55 mb-6">Escolha uma nova senha para sua conta.</p>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
