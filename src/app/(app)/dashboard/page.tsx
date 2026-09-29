import Image from "next/image";
import Link from "next/link";
import { ArrowRight, TrendingUp, TrendingDown, Wallet, type LucideIcon } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { getDashboardData } from "@/services/dashboard";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import { RetirementChart } from "@/components/charts/RetirementChart";
import { CompassDial } from "@/components/dashboard/CompassDial";
import { CompassDimensionList } from "@/components/dashboard/CompassDimensionList";
import { BehavioralProfileIcon } from "@/components/profile/BehavioralProfileIcon";
import { cn } from "@/lib/utils/cn";

const DARK_CARD = "bg-brand-800 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.5)]";
const HEALTH_BADGE_TONE: Record<"Excelente" | "Saudável" | "Em construção" | "Atenção", "ok" | "gold" | "danger"> = {
  Excelente: "ok",
  Saudável: "ok",
  "Em construção": "gold",
  Atenção: "danger",
};

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  const data = await getDashboardData(user.id);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6 space-y-6">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-sans font-bold text-[23px] tracking-tight text-onbrand">Olá, {firstName}.</h1>
          {/* Perfil comportamental (PCA) — não é mais um card próprio, fica
              no canto oposto desta mesma linha (pedido do Thiago). */}
          <div className="flex items-center gap-1.5 shrink-0 mr-2">
            <BehavioralProfileIcon profile={data.behavioralProfile.type} size="sm" />
            <span className="font-sans font-medium text-sm text-onbrand/80">{data.behavioralProfile.label}</span>
          </div>
        </div>

        <Card className={DARK_CARD}>
          <CardContent className="py-5">
            <div className="flex gap-3 items-start">
              <Image
                src="/avatars/tobias-alertas.png"
                alt="Tobias"
                width={38}
                height={38}
                className="tobias-mascot-soft shrink-0"
              />
              <div className="rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl bg-brand-700 px-4 py-3.5 flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gold-400 mb-1">Tobias</p>
                {/* brand-700 não troca de tom com o tema (de propósito), então o
                    texto usa brand-50 (também fixo) em vez de onbrand — que
                    inverteria pra escuro e ficaria ilegível no tema claro */}
                <p className="text-sm leading-relaxed text-brand-50">{data.tobiasMessage}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receitas/Despesas/Saldo do mês — antes era um card único "Seu mês";
            são os mesmos 3 números (income/expenses/balance), cada um agora
            com seu próprio card, ícone e variação vs. mês anterior. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SumCard
            label="Receitas do mês"
            value={data.month.income}
            trendPct={data.month.trend.incomePct}
            tone="ok"
            Icon={TrendingUp}
          />
          <SumCard
            label="Despesas do mês"
            value={data.month.expenses}
            trendPct={data.month.trend.expensesPct}
            tone="danger"
            Icon={TrendingDown}
          />
          <SumCard
            label="Saldo do mês"
            value={data.month.balance}
            trendPct={data.month.trend.balancePct}
            tone={data.month.balance >= 0 ? "ok" : "danger"}
            Icon={Wallet}
          />
        </div>

        {/* Ponteiro + Curva de aposentadoria lado a lado (mesma proporção de
            colunas de antes) — "Dica do Tobias" desceu pra uma faixa própria
            embaixo dos dois, em vez de dividir espaço/altura com a curva. Os
            avatares do Tobias piscando (TobiasMascot) saíram das duas: o
            status já aparecia em texto/badge, o bicho animado era redundante. */}
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-4">
          <Card className={DARK_CARD} data-tour="dashboard-ponteiro">
            <CardContent className="py-5">
              <div className="flex items-center justify-between gap-2.5 mb-1">
                <h2 className="font-display font-semibold text-lg text-onbrand">Seu Ponteiro</h2>
                {data.compass.length > 0 && (
                  <Badge tone={HEALTH_BADGE_TONE[data.healthStatus]}>{data.healthStatus}</Badge>
                )}
              </div>
              {data.compass.length === 0 ? (
                <p className="text-sm text-onbrand/60 mt-3">
                  Seu Ponteiro aparece assim que terminarmos a primeira conversa.
                </p>
              ) : (
                <>
                  <p className="text-xs text-onbrand/50 mb-2">Pontuação geral, 9 dimensões</p>
                  <div className="flex flex-wrap items-center justify-center gap-4 mt-1">
                    <CompassDial score={data.healthScore} status={data.healthStatus} size={112} />
                    <CompassDimensionList dimensions={data.compass} className="flex-1 min-w-[200px]" />
                  </div>
                  <div className="mt-3 text-right">
                    <Link href="/compass" className="text-xs text-gold-400 hover:underline inline-flex items-center gap-1">
                      Ver tudo <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={DARK_CARD}>
            <CardContent className="py-5">
              <div className="flex items-baseline gap-2.5 mb-1">
                <h2 className="font-display font-semibold text-lg text-onbrand">Curva de aposentadoria</h2>
                <Link href="/retirement" className="text-xs text-gold-400 hover:underline flex items-center gap-1">
                  Simular <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.retirementPreview ? (
                <>
                  <RetirementChart
                    simulation={data.retirementPreview}
                    targetAge={data.retirementTargetAge ?? data.retirementPreview.base.series.at(-1)?.age ?? 65}
                    height={230}
                    dark
                  />
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Badge tone={data.retirementPreview.base.onTrack ? "ok" : "warn"}>
                      {data.retirementPreview.base.onTrack ? "No alvo" : "Requer ajuste"}
                    </Badge>
                    <span className="text-[11px] text-onbrand/45">
                      Projeção do seu patrimônio total (contas + investimentos) em 3 cenários de retorno. Não é uma recomendação de investimento.
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-onbrand/60 mt-3">
                  Ainda não montamos seu plano de aposentadoria.{" "}
                  <Link href="/chat" className="text-gold-400 underline">
                    Vamos conversar sobre isso
                  </Link>
                  .
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Cada um dos 3 números do mês (receitas/despesas/saldo) virou seu próprio
 * card, com ícone, valor em BRL e variação % vs. o mês anterior (calculada em
 * services/dashboard.ts a partir dos mesmos agregadores que já existiam —
 * não é um número inventado). A linha de variação só aparece quando
 * `trendPct` não é null (mês anterior sem base de comparação válida).
 */
const SUM_CARD_TONE = {
  ok: { bar: "bg-ok-400", value: "text-ok-400", icon: "text-ok-400" },
  danger: { bar: "bg-danger-300", value: "text-danger-300", icon: "text-danger-300" },
} as const;

function SumCard({
  label,
  value,
  trendPct,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  trendPct: number | null;
  tone: keyof typeof SUM_CARD_TONE;
  Icon: LucideIcon;
}) {
  const tones = SUM_CARD_TONE[tone];
  const trendUp = trendPct != null && trendPct >= 0;

  return (
    <Card className={cn(DARK_CARD, "relative overflow-hidden")}>
      <div className={cn("absolute inset-x-0 top-0 h-[3px]", tones.bar)} />
      <CardContent className="py-5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className={cn("h-3.5 w-3.5", tones.icon)} strokeWidth={2} />
          <p className="text-xs uppercase tracking-wide text-onbrand/60">{label}</p>
        </div>
        <p className={cn("font-sans font-medium text-2xl tracking-tight tabular-nums", tones.value)}>
          {formatBRL(value)}
        </p>
        {trendPct != null && (
          <p className="text-xs text-onbrand/50 mt-1">
            {trendUp ? "▲" : "▼"}{" "}
            {Math.abs(trendPct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. mês anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}
