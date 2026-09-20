"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatBRLInput } from "@/lib/utils/money";

/**
 * Campo de valor em reais com máscara "de banco" — os dígitos digitados vão
 * sempre entrando pela casa das unidades (centavos) e empurrando o resto pra
 * esquerda, com o Tobias plantando o ponto de milhar e a vírgula decimal
 * sozinho a cada tecla (digitar 1,2,3,4,5 vira 0,01 → 0,12 → 1,23 → 12,34 →
 * 123,45). Pedido do Thiago 2026-09-20: antes o campo deixava digitar livre
 * e só formatava no blur — bom pra digitar rápido, mas não "vai colocando
 * ponto e vírgula sempre no preenchimento" como ele queria em todo o
 * sistema, e ninguém aqui digita vírgula decimal por hábito de boleto/PDV.
 *
 * Por dentro o valor é guardado em centavos (inteiro) — a cada tecla a gente
 * ignora tudo que não é dígito e reconstrói o inteiro a partir de todos os
 * dígitos que sobraram no campo, então funciona igual pra digitar, apagar
 * (Backspace empurra um dígito de volta) e colar. O cursor é sempre forçado
 * pro final (só quando o campo está focado) — sem isso dava pra clicar no
 * meio do número e inserir um dígito ali, o que quebraria a lógica de
 * "dígito novo sempre na casa das unidades".
 *
 * Dois jeitos de usar, não excludentes:
 *  - `name` — pra formulário não controlado (`<form action={...}>` lendo
 *    FormData): um `<input type="hidden">` carrega o valor numérico
 *    (`123.45`) sob esse nome; o campo visível em si não tem `name`, então
 *    não é ele que é submetido.
 *  - `onValueChange` — pra uso controlado/inline (preview de parcela, total
 *    calculado etc.), chamado a cada tecla com o número já convertido.
 *
 * Deliberadamente NÃO aceita um `value` controlado por fora sincronizado via
 * useEffect — mesmo motivo do FilterBar (ver preferencias-de-estilo.md):
 * digitar re-dispararia o efeito e brigaria com o cursor. Pra resetar o
 * campo de fora, remonte com uma `key` diferente.
 */
export function CurrencyInput({
  id,
  name,
  defaultValue,
  onValueChange,
  placeholder = "0,00",
  className,
  required,
  disabled,
  autoFocus,
}: {
  id?: string;
  name?: string;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [cents, setCents] = useState(() => Math.round((defaultValue ?? 0) * 100));
  const inputRef = useRef<HTMLInputElement>(null);
  const text = cents ? formatBRLInput(cents / 100) : "";

  // Depois de cada tecla, se o campo ainda está com foco, garante que o
  // cursor fica no final — é isso que faz o próximo dígito sempre cair na
  // casa das unidades em vez de entrar onde a pessoa deixou o cursor antes.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [text]);

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => {
          // Ignora tudo que não é dígito (o "," e "." que aparecem no campo
          // são só formatação nossa, nunca vêm de digitação — o teclado
          // numérico do celular nem oferece esses caracteres) e reconstrói
          // o valor em centavos a partir do que sobrou.
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
          const newCents = digits ? Math.min(Number(digits), Number.MAX_SAFE_INTEGER) : 0;
          setCents(newCents);
          onValueChange?.(newCents / 100);
        }}
        className={cn(
          "w-full h-11 rounded-xl border border-transparent bg-brand-800 px-3.5 text-[15px] text-onbrand text-right tabular-nums",
          "placeholder:text-onbrand/35 focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400/60",
          "disabled:opacity-50 disabled:cursor-not-allowed transition-shadow",
          className
        )}
      />
      {/* Vazio manda string vazia, não "0.00" — senão um campo opcional que
          depende de formData.get(name) ser "vazio" (ex: "valor atual, igual
          ao investido se não preencher") nunca cairia no fallback, já que
          uma string não-vazia como "0.00" é truthy mesmo valendo zero. */}
      {name && <input type="hidden" name={name} value={cents ? (cents / 100).toFixed(2) : ""} />}
    </>
  );
}
