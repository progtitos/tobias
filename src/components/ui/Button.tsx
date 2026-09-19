import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  // primary/danger usam fundo que NÃO troca de tom com o tema (brand-700/600
  // e danger-600 são "fixos" de propósito, ver globals.css) — por isso o
  // texto tem que ser brand-50 (também fixo, sempre claro) em vez de
  // onbrand, que inverteria pra texto escuro em cima de um fundo que
  // continua escuro no tema claro e ficaria ilegível.
  primary: "bg-brand-700 text-brand-50 hover:bg-brand-600 disabled:opacity-50",
  secondary: "bg-gold-500 text-ink-900 hover:bg-gold-600 disabled:bg-gold-500/50",
  outline: "border border-onbrand/20 text-onbrand hover:bg-onbrand/5 disabled:opacity-50",
  ghost: "text-onbrand/80 hover:bg-onbrand/5 disabled:opacity-50",
  danger: "bg-danger-600 text-brand-50 hover:opacity-90 disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
