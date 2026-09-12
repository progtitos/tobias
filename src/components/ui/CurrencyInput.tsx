"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatBRLInput, parseBRLInput } from "@/lib/utils/money";

/**
 * Campo de valor em reais que aceita o jeito que gente digita no Brasil —
 * vírgula decimal, ponto de milhar ("1.234,56") — em vez do
 * `<input type="number">` nativo, que rejeita vírgula e não agrupa milhar.
 *
 * Fica livre pra digitar (não reformata a cada tecla, senão o cursor pula de
 * lugar) e só normaliza a exibição no blur. O valor numérico em si (pra
 * cálculo/preview ao vivo) é recalculado a cada tecla via `onValueChange`.
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
  const [text, setText] = useState(() => (defaultValue ? formatBRLInput(defaultValue) : ""));
  const [numeric, setNumeric] = useState(defaultValue ?? 0);

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => {
          // Deixa passar só o que faz parte de um valor em reais — dígitos,
          // vírgula e ponto — sem tentar validar o formato completo enquanto
          // a pessoa ainda está digitando.
          const raw = e.target.value.replace(/[^0-9,.]/g, "");
          setText(raw);
          const value = parseBRLInput(raw);
          setNumeric(value);
          onValueChange?.(value);
        }}
        onBlur={() => {
          if (!text) return;
          const value = parseBRLInput(text);
          setNumeric(value);
          setText(value ? formatBRLInput(value) : "");
        }}
        className={cn(
          "w-full h-11 rounded-xl border border-black/20 bg-brand-900 px-3.5 text-[15px] text-onbrand text-right tabular-nums",
          "placeholder:text-onbrand/35 focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400/60",
          "disabled:opacity-50 disabled:cursor-not-allowed transition-shadow",
          className
        )}
      />
      {/* Vazio manda string vazia, não "0.00" — senão um campo opcional que
          depende de formData.get(name) ser "vazio" (ex: "valor atual, igual
          ao investido se não preencher") nunca cairia no fallback, já que
          uma string não-vazia como "0.00" é truthy mesmo valendo zero. */}
      {name && <input type="hidden" name={name} value={text ? numeric.toFixed(2) : ""} />}
    </>
  );
}
