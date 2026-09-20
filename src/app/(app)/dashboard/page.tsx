import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { getDashboardData } from "@/services/dashboard";
import type { CompassDimensionResult } from "@/services/compass";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import { RetirementChart } from "@/components/charts/RetirementChart";
import { CompassDial } from "@/components/dashboard/CompassDial";
import { TobiasMascot } from "@/components/dashboard/TobiasMascot";
import { BehavioralProfileIcon } from "@/components/profile/BehavioralProfileIcon";
import { cn } from "@/lib/utils/cn";
import type { CreditCardUsage } from "@/services/creditCards";

const DARK_CARD = "bg-brand-800 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.5)]";
const CHIP_DOT_TONE: Record<CompassDimensionResult["status"], string> = {
  Excelente: "bg-ok-400",
  Saudável: "bg-ok-400",
  "Em construção": "bg-gold-400",
  Atenção: "bg-danger-300",
};

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  const data = await getDashboardData(user.id);
  const firstName = user.name.split(" ")[0];

  // Highlight the strongest dimension plus the two that most need attention,
  // instead of the full 9-dimension list — the full breakdown still lives on
  // /compass, this is just the "de cara" snapshot.
  const sortedCompass = [...data.compass].sort((a, b) => b.score - a.score);
  const heroChips =
    sortedCompass.length > 0
      ? [sortedCompass[0], ...sortedCompass.slice(-2)].filter(
          (dim, i, arr) => arr.findIndex((d) => d.dimension === dim.dimension) === i
        )
      : [];

  // Drives the mood ring/message on each hero card's Tobias mascot — same
  // status classification the compass already uses elsewhere on this page.
  const compassMood: "ok" | "warn" =
    data.healthStatus === "Excelente" || data.healthStatus === "Saudável" ? "ok" : "warn";
  const compassMoodMessage =
    compassMood === "ok" ? "Seu Ponteiro está indo bem!" : "Em construção, vamos evoluir juntos";
  const retirementMood: "ok" | "warn" = data.retirementPreview?.base.onTrack ? "ok" : "warn";
  const retirementMoodMessage = !data.retirementPreview
    ? "Vamos montar seu plano juntos"
    : data.retirementPreview.base.onTrack
      ? "No alvo! Continue assim"
      : "Vamos ajustar o plano juntos";

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6 space-y-6">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <h1 className="font-sans font-bold text-[23px] tracking-tight text-onbrand">Olá, {firstName}.</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CreditCardAttentionCard card={data.cardNeedingAttention} totalCards={data.totalCreditCards} />
          <Card className={DARK_CARD} data-tour="dashboard-resumo">
            <CardContent className="py-5">
              <h2 className="font-display font-semibold text-base text-onbrand mb-3">Seu mês</h2>
              <MonthFlow
                income={data.month.income}
                expenses={data.month.expenses}
                investments={data.month.investments}
                balance={data.month.balance}
              />
            </CardContent>
          </Card>
          <Card className="bg-brand-800 border-gold-500/40 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.6)]">
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-wide text-onbrand/60 mb-1.5">Seu perfil</p>
              <div className="flex items-center gap-2.5">
                <BehavioralProfileIcon profile={data.behavioralProfile.type} size="sm" />
                <p className="font-sans font-medium text-[17px] leading-tight tracking-tight text-onbrand">
                  {data.behavioralProfile.label}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hero: Bússola + curva de aposentadoria + o Tobias, unificados e logo de cara. */}
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-4">
          <Card className={`${DARK_CARD} relative`} data-tour="dashboard-ponteiro">
            <TobiasMascot
              src="/avatars/tobias-bussola-financeira.png"
              mood={compassMood}
              message={compassMoodMessage}
            />
            <CardContent className="py-5">
              <div className="flex items-baseline gap-2.5 mb-1">
                <h2 className="font-display font-semibold text-lg text-onbrand">Seu Ponteiro</h2>
                <Link href="/compass" className="text-xs text-gold-400 hover:underline flex items-center gap-1">
                  Ver tudo <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.compass.length === 0 ? (
                <p className="text-sm text-onbrand/60 mt-3">
                  Seu Ponteiro aparece assim que terminarmos a primeira conversa.
                </p>
              ) : (
                <>
                  <p className="text-xs text-onbrand/50 mb-2">Pontuação geral, 9 dimensões</p>
                  <div className="flex justify-center">
                    <CompassDial score={data.healthScore} status={data.healthStatus} />
                  </div>
                  {heroChips.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                      {heroChips.map((c) => (
                        <span
                          key={c.dimension}
                          className="inline-flex items-center gap-1.5 rounded-full bg-onbrand/5 px-3 py-1.5 text-xs font-medium text-onbrand/75"
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${CHIP_DOT_TONE[c.status]}`} />
                          {c.label} {c.score}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className={`${DARK_CARD} relative`}>
              <TobiasMascot
                src="/avatars/tobias-curva-aposentadoria.png"
                mood={retirementMood}
                message={retirementMoodMessage}
              />
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
                      height={190}
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
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Substituiu o antigo card "Seu patrimônio" (pedido do Thiago): mostra o
 * cartão que precisa de mais atenção — o de maior % do limite usado no ciclo
 * aberto, quando há mais de um — em vez do patrimônio líquido, que continua
 * completo em /patrimonio, só parou de ter esse card dedicado aqui.
 */
function CreditCardAttentionCard({ card, totalCards }: { card: CreditCardUsage | null; totalCards: number }) {
  const usagePct = card?.usagePct != null ? Math.round(card.usagePct) : null;
  const usageTone = usagePct == null ? "bg-onbrand/30" : usagePct >= 90 ? "bg-danger-300" : usagePct >= 70 ? "bg-gold-400" : "bg-ok-400";
  const highAttention = usagePct != null && usagePct >= 90;

  return (
    <Card
      className={
        highAttention
          ? "bg-brand-800 border-danger-500/40 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.6)]"
          : DARK_CARD
      }
    >
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-wide text-onbrand/60 mb-1.5">
          {totalCards > 1 ? "Cartão em atenção" : "Seu cartão"}
        </p>

        {!card ? (
          <>
            <p className="font-sans font-medium text-[15px] text-onbrand/70 mb-2">Nenhum cartão cadastrado</p>
            <Link href="/conta" className="text-xs text-gold-400 hover:underline">
              Adicionar cartão →
            </Link>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <p className="font-sans font-medium text-[15px] text-onbrand truncate">{card.nickname}</p>
              {card.limitAmount != null && (
                <span className="text-xs text-onbrand/50 shrink-0">de {formatBRL(card.limitAmount)}</span>
              )}
            </div>
            <p className="font-sans font-medium text-[22px] tracking-tight tabular-nums text-onbrand mb-2">
              {formatBRL(card.currentCycleSpend)}
            </p>
            {usagePct != null && (
              <div className="h-1.5 rounded-full bg-onbrand/[0.07] overflow-hidden mb-1.5">
                <div className={cn("h-full", usageTone)} style={{ width: `${Math.min(usagePct, 100)}%` }} />
              </div>
            )}
            <p className="text-xs text-onbrand/50">
              {usagePct != null ? `${usagePct}% do limite usado` : "Sem limite cadastrado"}
              {card.dueDay ? ` · vence dia ${card.dueDay}` : ""}
            </p>
            {totalCards > 1 && (
              <p className="text-[11px] text-onbrand/40 mt-1">
                +{totalCards - 1} outro{totalCards - 1 === 1 ? "" : "s"} cartão{totalCards - 1 === 1 ? "" : "ões"}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * "Seu mês" used to be a flat 2x2 grid of numbers — accurate, but you had to
 * read all four to understand anything. This leads with the one number that
 * actually matters day-to-day (o saldo), then shows where the money that
 * didn't stay as saldo actually went as a single proportional bar (despesas
 * vs. investimentos, out of a receitas baseline) instead of two more
 * disconnected figures.
 */
function MonthFlow({
  income,
  expenses,
  investments,
  balance,
}: {
  income: number;
  expenses: number;
  investments: number;
  balance: number;
}) {
  // Scale against whichever is bigger — income, or everything that went out
  // — so the bar never silently overflows its own track when spending (+
  // investing) exceeds what came in that month.
  const scale = Math.max(income, expenses + investments, 1);
  const expensePct = (expenses / scale) * 100;
  const investPct = (investments / scale) * 100;

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-onbrand/60 mb-0.5">Saldo do mês</p>
          <p
            className={`font-sans font-medium text-2xl tracking-tight tabular-nums ${
              balance >= 0 ? "text-ok-400" : "text-danger-300"
            }`}
          >
            {formatBRL(balance)}
          </p>
        </div>
        <p className="text-xs text-onbrand/50 text-right leading-snug">
          de <span className="text-onbrand/80 font-medium tabular-nums">{formatBRL(income)}</span>
          <br />
          em receitas
        </p>
      </div>

      <div className="h-2.5 rounded-full bg-onbrand/[0.07] overflow-hidden flex">
        {expensePct > 0 && <div className="h-full bg-danger-300/85" style={{ width: `${expensePct}%` }} />}
        {investPct > 0 && <div className="h-full bg-gold-400" style={{ width: `${investPct}%` }} />}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        <FlowLegend dotClass="bg-danger-300/85" label="Despesas" value={expenses} />
        <FlowLegend dotClass="bg-gold-400" label="Investimentos" value={investments} />
      </div>
    </div>
  );
}

function FlowLegend({ dotClass, label, value }: { dotClass: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
      <span className="text-onbrand/55">{label}</span>
      <span className="text-onbrand/85 font-medium tabular-nums">{formatBRL(value)}</span>
    </div>
  );
}
