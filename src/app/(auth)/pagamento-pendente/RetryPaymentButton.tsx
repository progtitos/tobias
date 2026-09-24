"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Input";
import { checkPaymentStatusAction, retryPaymentCheckoutAction } from "./actions";

export function RetryPaymentButton() {
  const [checking, startChecking] = useTransition();
  const [retrying, startRetrying] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  return (
    <div className="mt-5 space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        loading={checking}
        onClick={() =>
          startChecking(async () => {
            setError(undefined);
            setNotice(undefined);
            const result = await checkPaymentStatusAction();
            if (result?.error) setError(result.error);
            else if (result?.stillPending) {
              setNotice(
                "Ainda não veio a confirmação do Mercado Pago de que o cartão foi cadastrado. Se você acabou de fazer isso, aguarde mais alguns segundos e tente de novo."
              );
            }
          })
        }
      >
        <RefreshCw className="h-3.5 w-3.5" /> Já confirmei, atualizar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        loading={retrying}
        onClick={() =>
          startRetrying(async () => {
            setError(undefined);
            setNotice(undefined);
            const result = await retryPaymentCheckoutAction();
            if (result?.error) setError(result.error);
          })
        }
      >
        Tentar pagamento novamente
      </Button>
      <FieldError>{error}</FieldError>
      {notice && !error && <p className="text-xs text-onbrand/50">{notice}</p>}
    </div>
  );
}
