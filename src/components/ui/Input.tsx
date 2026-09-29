import { forwardRef } from "react";
import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("text-sm font-medium text-onbrand/80 mb-1.5 block", className)} {...props} />
);

// Sombra interna sutil, não uma borda (29/09/2026, pedido do Thiago: "esta
// sem nada agora... parecendo tudo uma coisa só"). Contexto: até pouco
// atrás, uma regra global de reset fora de qualquer @layer fazia TODO
// border-color do app (inclusive border-transparent) renderizar como
// cream-200 quase-branco — o "achado" de maior alcance da auditoria de UX, já
// corrigido (ver o comentário em globals.css). O efeito colateral bom daquele
// bug era separar visualmente um campo do Card/Modal por trás quando os dois
// têm o mesmo bg-brand-800 (ex.: qualquer campo dentro do modal de editar
// transação); corrigir o bug removeu esse contorno sem querer. Em vez de
// trazer de volta um border-color (que voltaria a depender da cascata de
// layers e already causou o bug uma vez), a separação agora vem de uma
// box-shadow inset — nunca colide com border-color, então não pode repetir
// esse tipo de regressão.
export const FIELD_SHADOW = "shadow-[inset_0_1px_2px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(0,0,0,0.16)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full h-11 rounded-xl border border-transparent bg-brand-800 px-3.5 text-[15px] text-onbrand",
        FIELD_SHADOW,
        "placeholder:text-onbrand/35 focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400/60",
        "disabled:opacity-50 disabled:cursor-not-allowed transition-shadow",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-transparent bg-brand-800 px-3.5 py-2.5 text-[15px] text-onbrand",
        FIELD_SHADOW,
        "placeholder:text-onbrand/35 focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400/60",
        "disabled:opacity-50 disabled:cursor-not-allowed transition-shadow resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1.5 text-sm text-danger-300">{children}</p>;
}
