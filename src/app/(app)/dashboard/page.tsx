import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Camera, MessageCircle } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { getDashboardData } from "@/services/dashboard";
import { runBehaviorChecks } from "@/services/insights";
import type { CompassDimensionResult } from "@/services/compass";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatBRL } from "@/lib/utils/money";
import { RetirementChart } from "@/components/charts/RetirementChart";
import { CompassDial } from "@/components/dashboard/CompassDial";

const DARK_CARD = "bg-brand-800 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.5)]";
const CHIP_DOT_TONE: Record<CompassDimensionResult["status"], string> = {
  Excelente: "bg-ok-400",
  Saudável: "bg-ok-400",
  "Em construção": "bg-gold-400",
  Atenção: "bg-danger-300",
};

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  await runBehaviorChecks(user.id);
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

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6 space-y-6">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/avatars/tobias-sempre-ao-lado.png"
              alt="Tobias"
              width={44}
              height={44}
              className="rounded-full shrink-0"
            />
            <h1 className="font-sans font-bold text-[23px] tracking-tight text-onbrand">Olá, {firstName}.</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/receipts/new">
              <Button variant="outline" size="sm" className="border-brand-700 text-onbrand hover:bg-white/5">
                <Camera className="h-4 w-4" /> Fotografar nota
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="secondary">
                <MessageCircle className="h-4 w-4" /> Falar com o Tobias
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Seu patrimônio" value={formatBRL(data.netWorth.netWorth)} />
          <Card className={DARK_CARD}>
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
          <StatCard label="Saúde financeira" value={`${data.healthScore}/100`} accent />
        </div>

        {data.alerts.length > 0 && (
          <Card className="border-warn-600/40 bg-warn-100/10">
            <CardContent className="py-4 space-y-2">
              <p className="text-xs font-medium text-warn-600 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Atenção
              </p>
              {data.alerts.map((a) => (
                <p key={a.id} className="text-sm text-onbrand/80">
                  {a.message}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Hero: Bússola + curva de aposentadoria + o Tobias, unificados e logo de cara. */}
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-4">
          <Card className={DARK_CARD}>
            <CardContent className="py-5">
              <div className="flex items-center justify-between mb-1">
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
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-onbrand/75"
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
            <Card className={DARK_CARD}>
              <CardContent className="py-5">
                <div className="flex items-center justify-between mb-1">
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
                    <div className="flex gap-1.5 mt-2">
                      <Badge tone={data.retirementPreview.base.onTrack ? "ok" : "warn"}>
                        {data.retirementPreview.base.onTrack ? "No alvo" : "Requer ajuste"}
                      </Badge>
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
                    src="/logo-transparent.png"
                    alt="Tobias"
                    width={38}
                    height={38}
                    className="rounded-xl bg-brand-950 p-0.5 shrink-0"
                  />
                  <div className="rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl bg-brand-700 px-4 py-3.5 flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gold-400 mb-1">Tobias</p>
                    <p className="text-sm leading-relaxed text-onbrand">{data.tobiasMessage}</p>
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

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "bg-brand-800 border-gold-500/40 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.6)]" : DARK_CARD}>
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-wide text-onbrand/60 mb-1.5">{label}</p>
        <p className="font-sans font-medium text-[22px] tracking-tight tabular-nums text-onbrand">{value}</p>
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

      <div className="h-2.5 rounded-full bg-white/[0.07] overflow-hidden flex">
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
