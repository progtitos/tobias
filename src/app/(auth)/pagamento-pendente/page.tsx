import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { Card, CardContent } from "@/components/ui/Card";
import { RetryPaymentButton } from "./RetryPaymentButton";

export default async function PagamentoPendentePage() {
  const user = await requireUser();

  // The webhook usually flips this within seconds of the person finishing
  // Mercado Pago's checkout — if it already happened by the time this page
  // renders, just move them along instead of showing a stale waiting screen.
  if (user.subscriptionStatus !== "PENDING_PAYMENT") {
    redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }

  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <div className="mx-auto h-11 w-11 rounded-full bg-gold-400/10 flex items-center justify-center mb-4">
          <Clock className="h-5 w-5 text-gold-400" />
        </div>
        <h1 className="font-sans font-bold text-xl text-onbrand mb-2">Confirmando seu pagamento</h1>
        <p className="text-sm text-onbrand/60 leading-relaxed">
          Estamos aguardando a confirmação do Mercado Pago de que o cartão foi cadastrado. Isso costuma levar poucos
          segundos. Se você fechou a página do Mercado Pago antes de terminar, pode tentar de novo abaixo.
        </p>
        <RetryPaymentButton />
      </CardContent>
    </Card>
  );
}
