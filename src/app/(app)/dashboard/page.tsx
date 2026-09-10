import Link from "next/link";
import { AlertTriangle, ArrowRight, Camera, MessageCircle } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { getDashboardData } from "@/services/dashboard";
import { runBehaviorChecks } from "@/services/insights";
import { Card, CardContent } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatBRL } from "@/lib/utils/money";
import { RetirementChart } from "@/components/charts/RetirementChart";

const DARK_CARD = "bg-brand-900 border-brand-800";

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  await runBehaviorChecks(user.id);
  const data = await getDashboardData(user.id);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6 space-y-6">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-sans font-bold text-[23px] tracking-tight text-cream-50">Olá, {firstName}.</h1>
          <div className="flex gap-2">
            <Link href="/receipts/new">
              <Button variant="outline" size="sm" className="border-brand-700 text-cream-50 hover:bg-white/5">
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
          <StatCard label="Sua capacidade mensal" value={formatBRL(data.monthlyCapacity)} />
          <StatCard label="Saúde financeira" value={`${data.healthScore}/100`} accent />
        </div>

        {data.alerts.length > 0 && (
          <Card className="border-warn-600/40 bg-warn-100/10">
            <CardContent className="py-4 space-y-2">
              <p className="text-xs font-medium text-warn-600 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Atenção
              </p>
              {data.alerts.map((a) => (
                <p key={a.id} className="text-sm text-cream-50/80">
                  {a.message}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className={DARK_CARD}>
            <CardContent className="py-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg text-cream-50">Sua Bússola</h2>
                <Link href="/compass" className="text-xs text-gold-400 hover:underline flex items-center gap-1">
                  Ver tudo <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.compass.length === 0 ? (
                <p className="text-sm text-cream-50/60">Sua Bússola aparece assim que terminarmos a primeira conversa.</p>
              ) : (
                <div className="space-y-3">
                  {data.compass.map((c) => (
                    <div key={c.dimension}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-cream-50/70">{c.label}</span>
                        <span className="font-medium text-cream-50">{c.score}</span>
                      </div>
                      <ProgressBar value={c.score} className="bg-brand-800" barClassName="bg-gold-400" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={DARK_CARD}>
            <CardContent className="py-5">
              <h2 className="font-serif text-lg text-cream-50 mb-4">Seu mês</h2>
              <div className="grid grid-cols-2 gap-4">
                <MiniStat label="Receitas" value={data.month.income} tone="ok" />
                <MiniStat label="Despesas" value={data.month.expenses} tone="danger" />
                <MiniStat label="Investimentos" value={data.month.investments} tone="brand" />
                <MiniStat label="Saldo" value={data.month.balance} tone={data.month.balance >= 0 ? "ok" : "danger"} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className={DARK_CARD}>
            <CardContent className="py-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg text-cream-50">Seus sonhos</h2>
                <Link href="/goals" className="text-xs text-gold-400 hover:underline flex items-center gap-1">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.goals.length === 0 ? (
                <p className="text-sm text-cream-50/60">
                  Você ainda não tem sonhos ou objetivos cadastrados.{" "}
                  <Link href="/chat" className="text-gold-400 underline">
                    Conte um pro Tobias
                  </Link>
                  .
                </p>
              ) : (
                <div className="space-y-4">
                  {data.goals.slice(0, 4).map((g) => {
                    const pct = g.targetAmount ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
                    return (
                      <div key={g.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-cream-50/70">{g.title}</span>
                          <span className="font-medium text-cream-50">{g.targetAmount ? `${pct}%` : "-"}</span>
                        </div>
                        <ProgressBar value={pct} className="bg-brand-800" barClassName="bg-gold-400" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={DARK_CARD}>
            <CardContent className="py-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-serif text-lg text-cream-50">Curva de aposentadoria</h2>
                <Link href="/retirement" className="text-xs text-gold-400 hover:underline flex items-center gap-1">
                  Simular <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.retirementPreview ? (
                <>
                  <RetirementChart
                    simulation={data.retirementPreview}
                    targetAge={data.retirementPreview.base.series.at(-1)?.age ?? 65}
                    height={200}
                    dark
                  />
                  <div className="flex gap-1.5 mt-2">
                    <Badge tone={data.retirementPreview.base.onTrack ? "ok" : "warn"}>
                      {data.retirementPreview.base.onTrack ? "No caminho certo" : "Requer ajuste"}
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-sm text-cream-50/60 mt-3">
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

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "bg-brand-900 border-gold-500/40" : DARK_CARD}>
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-wide text-cream-50/60 mb-1.5">{label}</p>
        <p className="font-sans font-extrabold text-[21px] tracking-tight tabular-nums text-cream-50">{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "ok" | "danger" | "brand" }) {
  const toneClass = { ok: "text-ok-400", danger: "text-danger-300", brand: "text-cream-50" }[tone];
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-cream-50/60 mb-0.5">{label}</p>
      <p className={`font-medium tabular-nums ${toneClass}`}>{formatBRL(value)}</p>
    </div>
  );
}
