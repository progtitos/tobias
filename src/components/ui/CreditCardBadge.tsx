import { cn } from "@/lib/utils/cn";
import { findBank } from "@/lib/utils/banks";

/**
 * Cartão de crédito: retângulo com cantos arredondados (proporção real de
 * cartão), diferente do selo redondo de conta bancária (BankBadge) — decisão
 * registrada no tracker de redesign. Não existe uma biblioteca de ícone
 * pronta com a cara de cartão de cada banco (só bandeiras genéricas tipo
 * Visa/Mastercard), então o cartão é desenhado aqui reaproveitando a mesma
 * cor de marca do banco que já está em banks.ts, com um chip dourado
 * simulado — sem fingir ser o design oficial do cartão físico do banco.
 */
export function CreditCardBadge({
  brand,
  nickname,
  lastFourDigits,
  limitAmount,
  className,
  onClick,
}: {
  brand?: string | null;
  nickname: string;
  lastFourDigits?: string | null;
  limitAmount?: number | null;
  className?: string;
  onClick?: () => void;
}) {
  const bank = findBank(brand);
  const initials = (brand ?? nickname).slice(0, 2).toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      title={nickname}
      className={cn(
        "flex flex-col justify-between shrink-0 w-[168px] h-[100px] rounded-2xl p-3.5 text-left text-white shadow-[0_10px_20px_-8px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-0.5",
        bank ? bank.className : "bg-brand-700 text-onbrand",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span className="h-[18px] w-6 rounded-[4px] bg-gradient-to-br from-[#f2e2ae] to-[#c9a44e]" />
        <span className="text-xs font-bold uppercase tracking-wide opacity-90">{bank?.initials ?? initials}</span>
      </div>
      <div>
        <p className="text-[11px] font-medium tracking-widest opacity-85 tabular-nums mb-1">
          •••• {lastFourDigits ?? "----"}
        </p>
        <div className="flex items-end justify-between gap-2">
          <p className="text-[11px] truncate opacity-85">{nickname}</p>
          {limitAmount != null && (
            <p className="text-[11px] font-bold whitespace-nowrap">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(
                limitAmount
              )}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
