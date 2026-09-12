import { cn } from "@/lib/utils/cn";
import { findBank, fallbackInitials } from "@/lib/utils/banks";

/**
 * O selo circular usado tanto em Contas quanto em Transações. Três formas de
 * mostrar a marca, ver `logoMode` em banks.ts:
 *  1. "self"  — logo já traz o fundo colorido (Itaú, Bradesco, Santander,
 *     Nubank, Mercado Pago); preenche o selo quase inteiro.
 *  2. "bare"  — só o símbolo, sem fundo (BB, Caixa, Inter, C6); menor,
 *     centralizado sobre a cor da marca (className).
 *  3. "mask"  — símbolo de uma cor só (PicPay) usado como máscara branca
 *     sobre className, pra recriar o ícone oficial em vez do traço da marca
 *     sobre um fundo da mesma cor.
 *  4. Sem logo disponível (banco digitado à mão, "Outro banco") — cor +
 *     iniciais, como no mockup original.
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
        "relative inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full font-extrabold leading-none text-center",
        dim,
        bank ? bank.className : "bg-white/10 text-onbrand/60 border border-dashed border-white/25",
        className
      )}
      title={bankName}
    >
      {bank?.logoFile && bank.logoMode === "mask" ? (
        <span
          aria-hidden
          className="block bg-white"
          style={{
            width: "58%",
            height: "58%",
            WebkitMaskImage: `url(${bank.logoFile})`,
            maskImage: `url(${bank.logoFile})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskSize: "contain",
            maskSize: "contain",
          }}
        />
      ) : bank?.logoFile ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo local em /public, tamanho fixo pequeno, sem ganho real do next/image aqui
        <img
          src={bank.logoFile}
          alt=""
          aria-hidden
          className="block"
          style={
            bank.logoMode === "self"
              ? { width: "100%", height: "100%", objectFit: "cover" }
              : { width: "62%", height: "62%", objectFit: "contain" }
          }
        />
      ) : bank ? (
        bank.initials
      ) : (
        fallbackInitials(bankName)
      )}
    </span>
  );
}
