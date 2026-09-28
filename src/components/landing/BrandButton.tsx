import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "gold" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface BrandButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const base =
  "lp-press group inline-flex items-center justify-center gap-2 rounded-xl font-sans font-semibold tracking-tight whitespace-nowrap select-none";

const variants: Record<Variant, string> = {
  gold: "bg-gold-500 text-ink-900 shadow-[0_10px_30px_-12px_rgba(240,153,47,0.65)] hover:bg-gold-400 hover:shadow-[0_14px_38px_-12px_rgba(240,153,47,0.8)]",
  outline:
    "border border-white/14 bg-white/[0.03] text-cream-50 backdrop-blur-sm hover:border-gold-500/50 hover:bg-white/[0.07]",
  ghost: "text-cream-100 hover:text-cream-50 hover:bg-white/[0.06]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

/** Link estilizado como botão. Mantém semântica de âncora/navegação (Next Link) para CTAs. */
export default function BrandButton({
  href,
  variant = "gold",
  size = "md",
  className,
  children,
  ...rest
}: BrandButtonProps) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </Link>
  );
}
