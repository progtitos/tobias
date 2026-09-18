import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Flame, MessageCircle } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { getDashboardData } from "@/services/dashboard";
import type { CompassDimensionResult } from "@/services/compass";
import type { LevelTier } from "@/services/gamification";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import { greetingForHour } from "@/lib/utils/dates";
import { RetirementChart } from "@/components/charts/RetirementChart";
import { CompassDial } from "@/components/dashboard/CompassDial";
import { TobiasMascot } from "@/components/dashboard/TobiasMascot";

// "Direção B" (energia tipo Pierre) — ver comparativo enviado ao Thiago em
// 18/09/2026 e claude/especificacao-patrimonio-por-pilares.md pro que ainda
// não entrou aqui (breakdown por pilar depende de decisão/migração à parte).
// O gold-* continua sendo o acento de marca; lime-* é o segundo acento,
// fixo nos dois temas (globals.css), usado só nesta energia mais vibrante.
const GLASS_CARD = "bg-brand-800/90 border border-white/[0.06] shadow-[0_18px_40px_-22px_rgba(0,0,0,0.6)]";
const CHIP_DOT_TONE: Record<CompassDimensionResult["status"], string> = {
  Excelente: "bg-ok-400",
  Saudável: "bg-ok-400",
  "Em construção": "bg-gold-400",
  Atenção: "bg-danger-300",
};
const LEVEL_CHIP_TONE: Record<LevelTier, string> = {
  BRONZE: "bg-white/10 text-onbrand/80",
  PRATA: "bg-white/10 text-onbrand/80",
  OURO: "bg-lime-400 text-limechip-ink",
  PLATINA: "bg-lime-400 text-limechip-ink",
};

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  const data = await getDashboardData(user.id);
  const firstName = user.name.split(" ")[0];

  const sortedCompass = [...data.compass].sort((a, b) => b.score - a.score);
  const heroChips =
    sortedCompass.length > 0
      ? [sortedCompass[0], ...sortedCompass.slice(-2)].filter(
          (dim, i, arr) => arr.findIndex((d) => d.dimension === dim.dimension) === i
        )
      : [];

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

  const heroSubtitle =
    data.compass.length === 0
      ? "Vamos começar a organizar sua vida financeira."
      : `Sua saúde financeira está ${data.healthStatus.toLowerCase()}.`;

  return (
    <div className="flex-1 bg-brand-950">
      {/* Hero — sangra até a borda da área de conteúdo (fora do max-w-5xl),
          é o que dá a sensação de "capa" em vez de mais um card na grade. */}
      <div
        className="relative overflow-hidden px-5 pt-6 pb-14"
        style={{
          background:
            "radial-gradient(130% 100% at 12% -10%, rgba(200,241,105,.14), transparent 55%)," +
            "radial-gradient(90% 70% at 92% 0%, rgba(255,182,72,.12), transparent 60%)," +
            "linear-gradient(180deg, var(--color-brand-900) 0%, var(--color-brand-950) 100%)",
        }}
      >
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 font-display font-bold text-onbrand">
              <span className="h-2 w-2 rounded-full bg-lime-400" />
              Tobias
            </div>
            {data.level && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold font-sans ${LEVEL_CHIP_TONE[data.level.tier]}`}
              >
                {data.level.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Image
              src="/avatars/tobias-boas-vindas.png"
              alt="Tobias"
              width={64}
              height={64}
              className="rounded-full shrink-0 ring-2 ring-lime-400/60"
            />
            <div className="min-w-0">
              <h1 className="font-display font-bold text-[21px] text-onbrand leading-tight tracking-tight">
                {greetingForHour()}, {firstName}.
              </h1>
              <p className="text-[13px] text-onbrand/60 mt-0.5">{heroSubtitle}</p>
            </div>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-2 text-xs font-medium text-onbrand/80">
            <Flame className={`h-4 w-4 ${data.streakDays > 0 ? "text-gold-400" : "text-onbrand/40"}`} strokeWidth={2} />
            {data.streakDays > 0
              ? `${data.streakDays} dia${data.streakDays === 1 ? "" : "s"} seguido${data.streakDays === 1 ? "" : "s"} organizando as finanças`
              : "Ainda sem sequência — hoje é um bom dia pra começar"}
          </div>
        </div>
      </div>

      {/* Conteúdo — sobe por cima do fim do hero (margin negativa), efeito
          de "capa por trás dos cards" sem precisar de posicionamento absoluto. */}
      <div className="max-w-5xl mx-auto w-full px-5 -mt-8 pb-6 space-y-4 relative z-10">
        <Card className={GLASS_CARD}>
          <CardContent className="py-5">
            <p className="text-xs uppercase tracking-wide text-onbrand/55 mb-1.5">Patrimônio líquido</p>
            <p className="font-display font-extrabold text-[28px] tracking-tight tabular-nums text-onbrand mb-4">
              {formatBRL(data.netWorth.netWorth)}
            </p>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
              <MiniStat label="Em contas" value={formatBRL(data.netWorth.liquidAssets)} />
              <MiniStat label="Saúde financeira" value={`${data.healthScore}/100`} accent />
            </div>
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
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

        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-4">
          <Card className={`${GLASS_CARD} relative`}>
            <TobiasMascot
              src="/avatars/tobias-bussola-financeira.png"
              mood={compassMood}
              message={compassMoodMessage}
            />
            <CardContent className="py-5">
              <div className="flex items-baseline gap-2.5 mb-1">
                <h2 className="font-display font-semibold text-lg text-onbrand">Seu Ponteiro</h2>
                <Link href="/compass" className="text-xs text-lime-400 hover:underline flex items-center gap-1 font-medium">
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
            <Card className={`${GLASS_CARD} relative`}>
              <TobiasMascot
                src="/avatars/tobias-curva-aposentadoria.png"
                mood={retirementMood}
                message={retirementMoodMessage}
              />
              <CardContent className="py-5">
                <div className="flex items-baseline gap-2.5 mb-1">
                  <h2 className="font-display font-semibold text-lg text-onbrand">Curva de aposentadoria</h2>
                  <Link href="/retirement" className="text-xs text-lime-400 hover:underline flex items-center gap-1 font-medium">
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
                    <Link href="/chat" className="text-lime-400 underline">
                      Vamos conversar sobre isso
                    </Link>
                    .
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className={GLASS_CARD}>
              <CardContent className="py-5">
                <div className="flex gap-3 items-start">
                  <Image
                    src="/avatars/tobias-alertas.png"
                    alt="Tobias"
                    width={38}
                    height={38}
                    className="tobias-mascot-soft shrink-0"
                  />
                  <div className="rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl bg-brand-700 px-4 py-3.5 flex-1 min-w-0 border border-lime-400/20">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-lime-400 mb-1">Tobias</p>
                    <p className="text-sm leading-relaxed text-onbrand">{data.tobiasMessage}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA flutuante — mesmo destino de sempre (/chat), só com o tratamento
            visual da Direção B. sticky (não fixed) pra não brigar com a bottom
            nav mobile nem cobrir conteúdo em telas curtas. */}
        <Link
          href="/chat"
          className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-full bg-lime-400 text-limechip-ink font-sans font-bold text-sm px-5 py-3.5 shadow-[0_16px_30px_-12px_rgba(200,241,105,0.45)] hover:brightness-105 transition"
        >
          <span className="flex items-center gap-2">
            <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
            Perguntar ao Tobias
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Mesma lógica de sempre (líder com o saldo, o resto como uma barra
 * proporcional única) — só o tratamento visual mudou pra Direção B
 * (investimentos em lime em vez de dourado, pra reforçar o segundo acento).
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
        {investPct > 0 && <div className="h-full bg-lime-400" style={{ width: `${investPct}%` }} />}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        <FlowLegend dotClass="bg-danger-300/85" label="Despesas" value={expenses} />
        <FlowLegend dotClass="bg-lime-400" label="Investimentos" value={investments} />
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

function MiniStat({
  label,
  value,
  accent,
  positive,
}: {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
}) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-wide text-onbrand/55 mb-0.5">{label}</p>
      <p
        className={`font-sans font-semibold text-base tracking-tight tabular-nums ${
          accent ? "text-lime-400" : positive === false ? "text-danger-300" : "text-onbrand"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
