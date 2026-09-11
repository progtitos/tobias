"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Input";
import { retryPaymentCheckoutAction } from "./actions";

export function RetryPaymentButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="mt-5 space-y-2">
      <Button variant="outline" size="sm" className="w-full" onClick={() => router.refresh()}>
        <RefreshCw className="h-3.5 w-3.5" /> Já confirmei, atualizar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await retryPaymentCheckoutAction();
            if (result?.error) setError(result.error);
          })
        }
      >
        Tentar pagamento novamente
      </Button>
      <FieldError>{error}</FieldError>
    </div>
  );
}
