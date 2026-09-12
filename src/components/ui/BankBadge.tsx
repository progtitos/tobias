import { cn } from "@/lib/utils/cn";
import { findBank, fallbackInitials } from "@/lib/utils/banks";

/**
 * O selo quadrado-arredondado (estilo ícone do Itaú) usado tanto em Contas
 * quanto em Transações. Bancos do catálogo ganham a cor real da marca; um
 * nome digitado à mão (de antes do seletor existir, ou "Outro banco") cai
 * num quadrado neutro com as iniciais do que foi digitado.
 */
export function BankBadge({
  bankName,
  size = "sm",
  className,
}: {
  bankName: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const bank = findBank(bankName);
  const dim = size === "lg" ? "h-11 w-11 text-[13px]" : "h-[26px] w-[26px] text-[10px]";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 rounded-[28%] font-extrabold leading-none text-center",
        dim,
        bank ? bank.className : "bg-white/10 text-onbrand/60 border border-dashed border-white/25",
        className
      )}
      title={bankName}
    >
      {bank ? bank.initials : fallbackInitials(bankName)}
    </span>
  );
}
