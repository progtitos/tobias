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

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  await runBehaviorChecks(user.id);
  const data = await getDashboardData(user.id);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex-1 px-5 py-6 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-brand-950">Olá, {firstName}.</h1>
        <div className="flex gap-2">
          <Link href="/receipts/new">
            <Button variant="outline" size="sm">
              <Camera className="h-4 w-4" /> Fotografar nota
            </Button>
          </Link>
          <Link href="/chat">
            <Button size="sm">
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
        <Card className="border-warn-600/30 bg-warn-100/50">
          <CardContent className="py-4 space-y-2">
            <p className="text-xs font-medium text-warn-600 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Atenção
            </p>
            {data.alerts.map((a) => (
              <p key={a.id} className="text-sm text-ink-700">
                {a.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg text-brand-950">Sua Bússola</h2>
              <Link href="/compass" className="text-xs text-brand-800 hover:underline flex items-center gap-1">
                Ver tudo <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {data.compass.length === 0 ? (
              <p className="text-sm text-ink-500">Sua Bússola aparece assim que terminarmos a primeira conversa.</p>
            ) : (
              <div className="space-y-3">
                {data.compass.map((c) => (
                  <div key={c.dimension}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-ink-700">{c.label}</span>
                      <span className="font-medium text-ink-900">{c.score}</span>
                    </div>
                    <ProgressBar value={c.score} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <h2 className="font-serif text-lg text-brand-950 mb-4">Seu mês</h2>
            <div className="grid grid-cols-2 gap-4">
              <MiniStat label="Receitas" value={data.month.income} tone="ok" />
              <MiniStat label="Despesas" value={data.month.expenses} tone="danger" />
              <MiniStat label="Investimentos" value={data.month.investments} tone="brand" />
              <MiniStat label="Saldo" value={data.month.balance} tone={data.month.balance >= 0 ? "ok" : "danger"} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg text-brand-950">Seus sonhos</h2>
              <Link href="/goals" className="text-xs text-brand-800 hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {data.goals.length === 0 ? (
              <p className="text-sm text-ink-500">
                Você ainda não tem sonhos ou objetivos cadastrados.{" "}
                <Link href="/chat" className="text-brand-800 underline">
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
                        <span className="text-ink-700">{g.title}</span>
                        <span className="font-medium text-ink-900">{g.targetAmount ? `${pct}%` : "—"}</span>
                      </div>
                      <ProgressBar value={pct} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-serif text-lg text-brand-950">Curva de aposentadoria</h2>
              <Link href="/retirement" className="text-xs text-brand-800 hover:underline flex items-center gap-1">
                Simular <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {data.retirementPreview ? (
              <>
                <RetirementChart simulation={data.retirementPreview} targetAge={data.retirementPreview.base.series.at(-1)?.age ?? 65} height={200} />
                <div className="flex gap-1.5 mt-2">
                  <Badge tone={data.retirementPreview.base.onTrack ? "ok" : "warn"}>
                    {data.retirementPreview.base.onTrack ? "No caminho certo" : "Requer ajuste"}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-500 mt-3">
                Ainda não montamos seu plano de aposentadoria.{" "}
                <Link href="/chat" className="text-brand-800 underline">
                  Vamos conversar sobre isso
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-gold-500/40 bg-gold-100/30" : undefined}>
      <CardContent className="py-5">
        <p className="text-xs text-ink-500 mb-1">{label}</p>
        <p className="font-serif text-2xl text-brand-950">{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "ok" | "danger" | "brand" }) {
  const toneClass = { ok: "text-ok-600", danger: "text-danger-600", brand: "text-brand-800" }[tone];
  return (
    <div>
      <p className="text-xs text-ink-500 mb-0.5">{label}</p>
      <p className={`font-medium tabular-nums ${toneClass}`}>{formatBRL(value)}</p>
    </div>
  );
}
