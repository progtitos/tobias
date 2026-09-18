import { Shield, Compass, Target, Sun, LifeBuoy, Sprout, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { BehavioralProfile } from "@/services/behavioralProfile";

// Um ícone só, do próprio lucide-react (regra do design system — seção 8:
// "biblioteca de ícones, exclusivamente"), em vez de arte ilustrada nova:
// esta sessão não tem uma ferramenta de geração de imagem disponível pra
// pintar no estilo dos avatares do Tobias (ver
// claude/especificacao-perfil-comportamental-onboarding.md). Todos os 6
// perfis usam o MESMO tratamento visual (badge circular dourado) de
// propósito — a distinção vem só do glifo e do rótulo, nunca da cor, pra
// nenhum perfil (em especial "Apagando Incêndio") ler como um julgamento
// "perfil bom vs. perfil ruim".
const PROFILE_ICON: Record<BehavioralProfile, LucideIcon> = {
  CAUTIOUS_GUARDIAN: Shield,
  CONFIDENT_INVESTOR: Compass,
  GOAL_BUILDER: Target,
  LIFESTYLE_SPENDER: Sun,
  MONTHLY_SURVIVOR: LifeBuoy,
  EMERGING_ORGANIZER: Sprout,
};

export function BehavioralProfileIcon({
  profile,
  size = "md",
  className,
}: {
  profile: BehavioralProfile;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = PROFILE_ICON[profile];
  const dims = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconDims = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 bg-gold-500/10 border border-gold-400/30",
        dims,
        className
      )}
    >
      <Icon className={cn(iconDims, "text-gold-400")} strokeWidth={1.75} />
    </div>
  );
}
