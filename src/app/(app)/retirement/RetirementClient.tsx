"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Sparkles, Info, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RetirementChart } from "@/components/charts/RetirementChart";
import { formatBRL } from "@/lib/utils/money";
import { parseDateOnly } from "@/lib/utils/dates";
import { simulateRetirementCurve, requiredMonthlyContribution, type RetirementInputs } from "@/services/retirement";
import { computeGuaranteedMonthlyIncome, computeAverageSalaryFromHistory, type Gender } from "@/services/inss";
import { saveRetirementPlanAction, uploadCnisAction, clearSalaryHistoryAction, type UploadCnisState } from "./actions";

type Defaults = Omit<RetirementInputs, "currentNetWorth" | "guaranteedMonthlyIncome"> & {
  birthDate: Date | null;
  gender: Gender | null;
  contributionYearsToDate: number | null;
  averageMonthlySalary: number | null;
  guaranteedMonthlyIncomeOverride: number | null;
};

/** Um Sonho/Objetivo (Patrimônio) com data-alvo, pronto pra virar um marcador
 * na Curva de aposentadoria. `yearsFromNow` já vem calculado do servidor
 * (ver retirement/page.tsx) — o cliente só soma à idade atual digitada. */
export type GoalMarker = {
  id: string;
  title: string;
  type: string;
  targetAmount: number | null;
  achieved: boolean;
  yearsFromNow: number;
};

export function RetirementClient({
  defaults,
  currentNetWorth,
  hasPlan,
  goalMarkers,
  salaryHistory,
}: {
  defaults: Defaults;
  currentNetWorth: number;
  hasPlan: boolean;
  goalMarkers: GoalMarker[];
  /** Histórico salarial real importado do Extrato do CNIS (ver retirement/page.tsx), vazio se a pessoa nunca importou. */
  salaryHistory: { competencia: string; salaryAmount: number }[];
}) {
  const [inputs, setInputs] = useState<Defaults>(defaults);
  const [saved, setSaved] = useState(hasPlan);
  const [pending, startTransition] = useTransition();

  // Convertido uma vez (não muda durante a sessão, só via revalidação da
  // página depois de importar/remover o extrato) — evita reconstruir a
  // lista de Dates a cada tecla digitada no formulário.
  const parsedSalaryHistory = useMemo(
    () => salaryHistory.map((r) => ({ competencia: new Date(r.competencia), salaryAmount: r.salaryAmount })),
    [salaryHistory]
  );
  const hasImportedSalaryHistory = parsedSalaryHistory.length > 0;

  const { guaranteedMonthlyIncome, inssEstimate, averageSalarySource } = useMemo(
    () =>
      computeGuaranteedMonthlyIncome({
        targetRetirementAge: inputs.targetRetirementAge,
        birthDate: inputs.birthDate,
        gender: inputs.gender,
        contributionYearsToDate: inputs.contributionYearsToDate,
        averageMonthlySalary: inputs.averageMonthlySalary,
        guaranteedMonthlyIncomeOverride: inputs.guaranteedMonthlyIncomeOverride,
        salaryHistory: parsedSalaryHistory,
      }),
    [
      inputs.targetRetirementAge,
      inputs.birthDate,
      inputs.gender,
      inputs.contributionYearsToDate,
      inputs.averageMonthlySalary,
      inputs.guaranteedMonthlyIncomeOverride,
      parsedSalaryHistory,
    ]
  );

  const fullInputs: RetirementInputs = { ...inputs, currentNetWorth, guaranteedMonthlyIncome };

  // Converte "daqui a quantos anos" (fixo, calculado no servidor) pra idade
  // no eixo X do gráfico, que é a unidade que o resto da curva usa — soma a
  // idade atual que a pessoa está digitando agora, então o marcador
  // acompanha se ela ajustar o campo "Sua idade".
  const chartGoalMarkers = goalMarkers.map((g) => ({
    id: g.id,
    title: g.title,
    type: g.type,
    targetAmount: g.targetAmount,
    achieved: g.achieved,
    age: inputs.currentAge + g.yearsFromNow,
  }));

  const simulation = useMemo(() => simulateRetirementCurve(fullInputs), [JSON.stringify(fullInputs)]);
  const suggestedContribution = useMemo(
    () => requiredMonthlyContribution(fullInputs, "base"),
    [JSON.stringify(fullInputs)]
  );

  function set<K extends keyof Defaults>(key: K, value: Defaults[K]) {
    setSaved(false);
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      // Sem isso, qualquer rejeição da action (ex.: validação de "renda
      // mensal desejada" zerada) virava uma exceção não tratada dentro da
      // transição — o clique no botão simplesmente não fazia nada visível,
      // sem erro nenhum na tela (bug reportado pelo Thiago 2026-09-20:
      // "botão salvar plano está bugado").
      try {
        await saveRetirementPlanAction(inputs);
        setSaved(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar o plano.");
      }
    });
  }

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-4xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-sans font-bold text-2xl text-onbrand">Curva de aposentadoria</h1>
          <p className="text-sm text-onbrand/55 mt-1">
            Simule 3 cenários de retorno sobre seu patrimônio total de hoje ({formatBRL(currentNetWorth)}: contas + investimentos). Não é uma recomendação de investimento nem sua alocação real.
          </p>
        </div>
        <Button size="sm" loading={pending} onClick={save}>
          <Save className="h-3.5 w-3.5" /> {saved ? "Salvo" : "Salvar plano"}
        </Button>
      </div>

      {/* Gráfico em linha própria, largura cheia — antes ele dividia uma
          grid de 2 colunas com uma coluna lateral de 260px empilhando os
          dois cards de formulário, então a coluna do gráfico (bem mais
          curta que as duas de formulário juntas) ou esticava por dentro
          (align-items: stretch, 1ª tentativa) ou sobrava vazio abaixo dela
          na página (2ª tentativa) — em ambos os casos um vão vazio enorme.
          Feedback do Thiago 2026-09-20 ("continua uma coluna gigante e um
          vão vazio"). Tirando o gráfico da grid ele só ocupa a altura que
          precisa, e os dois cards de formulário abaixo, lado a lado, têm
          alturas parecidas o bastante pra não sobrar vão perceptível. */}
      <div className="mt-6 space-y-6">
        <Card>
          <CardContent className="py-5">
            <RetirementChart
              simulation={simulation}
              targetAge={inputs.targetRetirementAge}
              height={300}
              dark
              goalMarkers={chartGoalMarkers}
            />
            <div className="flex flex-wrap gap-1.5 mt-3">
              <ScenarioBadge label="Conservador" onTrack={simulation.conservative.onTrack} />
              <ScenarioBadge label="Base" onTrack={simulation.base.onTrack} />
              <ScenarioBadge label="Agressivo" onTrack={simulation.aggressive.onTrack} />
            </div>
            <div className="mt-4 space-y-1.5 text-sm">
              <p className="text-onbrand/70">
                Patrimônio necessário para viver de renda: <span className="font-medium text-onbrand">{formatBRL(simulation.requiredNetWorth)}</span>
                {guaranteedMonthlyIncome > 0 && (
                  <span className="text-onbrand/50">
                    {" "}
                    (já considerando {formatBRL(guaranteedMonthlyIncome)}/mês de renda garantida)
                  </span>
                )}
              </p>
              <p className="text-onbrand/70">
                Projeção no cenário base aos {inputs.targetRetirementAge} anos:{" "}
                <span className="font-medium text-onbrand">{formatBRL(simulation.base.finalValueAtTargetAge)}</span>
              </p>
              {inssEstimate?.bestRule && (
                <p className="text-onbrand/50 flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Estimativa de INSS pela {inssEstimate.bestRule.label}: {formatBRL(inssEstimate.bestRule.monthlyBenefit ?? 0)}/mês
                  {inssEstimate.bestRule.approximate ? " (aproximado, usa fator previdenciário)" : ""}.{" "}
                  {averageSalarySource === "cnis"
                    ? "Média salarial calculada a partir do seu Extrato do CNIS importado."
                    : "Média salarial estimada por você."}{" "}
                  Confira o valor exato no Meu INSS antes de decidir algo com base nele.
                </p>
              )}
              {!inssEstimate?.bestRule && inputs.birthDate && inputs.gender && inputs.contributionYearsToDate != null && inputs.averageMonthlySalary != null && (
                <p className="text-onbrand/50 flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Com esses dados, você ainda não teria direito ao INSS na idade-alvo escolhida. A renda garantida está zerada nesta simulação.
                </p>
              )}
              {!simulation.base.onTrack && (
                <p className="text-gold-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  Para chegar lá no cenário base, o aporte mensal precisaria ser de aproximadamente{" "}
                  <span className="font-medium">{formatBRL(suggestedContribution)}</span>.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-fit">
          <CardContent className="py-5 space-y-4">
            <NumberField label="Sua idade" value={inputs.currentAge} onChange={(v) => set("currentAge", v)} step={1} />
            <NumberField
              label="Idade para se aposentar"
              value={inputs.targetRetirementAge}
              onChange={(v) => set("targetRetirementAge", v)}
              step={1}
            />
            <MoneyField
              label="Renda mensal desejada"
              defaultValue={inputs.desiredMonthlyIncome}
              onChange={(v) => set("desiredMonthlyIncome", v)}
            />
            <MoneyField
              label="Aporte mensal atual"
              defaultValue={inputs.monthlyContribution}
              onChange={(v) => set("monthlyContribution", v)}
            />
            <div>
              <Label>Retorno anual esperado (%)</Label>
              <div className="grid grid-cols-3 gap-1.5">
                <MiniPctField
                  label="Cons."
                  value={inputs.expectedReturnConservative}
                  onChange={(v) => set("expectedReturnConservative", v)}
                />
                <MiniPctField label="Base" value={inputs.expectedReturnBase} onChange={(v) => set("expectedReturnBase", v)} />
                <MiniPctField
                  label="Agr."
                  value={inputs.expectedReturnAggressive}
                  onChange={(v) => set("expectedReturnAggressive", v)}
                />
              </div>
            </div>
            <NumberField
              label="Inflação anual esperada (%)"
              value={inputs.expectedInflation * 100}
              onChange={(v) => set("expectedInflation", v / 100)}
              step={0.5}
            />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="py-5 space-y-4">
            <div>
              <Label>Renda garantida (INSS)</Label>
              <p className="text-xs text-onbrand/45 -mt-1">
                Opcional. Preenchendo os 4 campos abaixo, calculamos uma estimativa do seu benefício do INSS pelas regras vigentes
                e usamos só o que falta da renda desejada (o "gap essencial") como saída do patrimônio investido.
              </p>
            </div>
            <div>
              <Label>Data de nascimento</Label>
              {/* defaultValue (não-controlado) em vez de value: um
                  <input type="date"> controlado, com o `value` sendo
                  reescrito a cada tecla, brigava com o próprio navegador
                  enquanto o ano estava incompleto (o `.value` do campo só
                  existe depois que os 3 blocos — dia/mês/ano — ficam
                  válidos, então o React ficava tentando forçar de volta um
                  valor vazio no meio da digitação) — dava pra travar no
                  meio do preenchimento do ano (bug reportado pelo Thiago
                  2026-09-20). O valor final só é lido no onChange, quando o
                  navegador já considera a data completa. */}
              <Input
                type="date"
                defaultValue={inputs.birthDate ? inputs.birthDate.toISOString().slice(0, 10) : undefined}
                onChange={(e) => set("birthDate", e.target.value ? parseDateOnly(e.target.value) : null)}
              />
            </div>
            <div>
              <Label>Sexo (para as regras do INSS)</Label>
              <Select
                value={inputs.gender ?? ""}
                onChange={(e) => set("gender", (e.target.value || null) as Gender | null)}
              >
                <option value="">Não informado</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
              </Select>
            </div>
            <NumberField
              label="Anos de contribuição já acumulados"
              value={inputs.contributionYearsToDate ?? 0}
              onChange={(v) => set("contributionYearsToDate", v || null)}
              step={0.5}
            />
            {hasImportedSalaryHistory ? (
              <SalaryHistorySummary history={parsedSalaryHistory} />
            ) : (
              <>
                <MoneyField
                  label="Média salarial de contribuição"
                  defaultValue={inputs.averageMonthlySalary ?? 0}
                  onChange={(v) => set("averageMonthlySalary", v || null)}
                />
                <p className="text-xs text-onbrand/40 -mt-3">
                  É a média de tudo que você já ganhou desde que começou a contribuir, corrigida pela inflação, não o
                  seu salário de hoje. Se não souber calcular isso de cabeça, importe o Extrato do CNIS abaixo e a
                  gente calcula pra você.
                </p>
                <CnisImportForm />
              </>
            )}
            <MoneyField
              label="Já sabe o valor do seu benefício? (opcional)"
              defaultValue={inputs.guaranteedMonthlyIncomeOverride ?? 0}
              onChange={(v) => set("guaranteedMonthlyIncomeOverride", v || null)}
            />
            <p className="text-xs text-onbrand/40 -mt-3">
              Preenchendo isso, ignoramos a estimativa e usamos direto o valor informado (ex.: você já consultou o Meu INSS).
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
      </div>
    </div>
  );
}

function ScenarioBadge({ label, onTrack }: { label: string; onTrack: boolean }) {
  return (
    <Badge tone={onTrack ? "ok" : "warn"}>
      {label}: {onTrack ? "no caminho certo" : "requer ajuste"}
    </Badge>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.01,
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

// Todo valor em reais usa CurrencyInput, sem exceção (design-system-tobias.md
// §10) — a tela de Aposentadoria era a única que ainda usava
// `<input type="number">` cru com um "R$" desenhado à mão por cima (achado
// da auditoria de UX + pedido do Thiago 2026-09-20 pra máscara em tempo
// real valer em todo o sistema). CurrencyInput não aceita `value` controlado
// de fora, então aqui ele fica "não-controlado", só reportando pra cima via
// `onChange` a cada tecla — mesmo padrão já usado em InvestimentosClient.
function MoneyField({
  label,
  defaultValue,
  onChange,
}: {
  label: string;
  defaultValue: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <CurrencyInput defaultValue={defaultValue} onValueChange={onChange} />
    </div>
  );
}

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Substitui o campo manual de "média salarial de contribuição" quando a
 * pessoa já importou o Extrato do CNIS (retirement/page.tsx). Mostra a
 * média já calculada e corrigida (mesma conta que computeGuaranteedMonthlyIncome
 * usa por baixo dos panos) em vez de deixar a pessoa reestimar à mão.
 */
function SalaryHistorySummary({ history }: { history: { competencia: Date; salaryAmount: number }[] }) {
  const average = useMemo(() => computeAverageSalaryFromHistory(history), [history]);
  const sorted = useMemo(() => [...history].sort((a, b) => a.competencia.getTime() - b.competencia.getTime()), [history]);
  const distinctMonths = useMemo(
    () => new Set(sorted.map((r) => `${r.competencia.getUTCFullYear()}-${r.competencia.getUTCMonth()}`)).size,
    [sorted]
  );
  const first = sorted[0]?.competencia;
  const last = sorted[sorted.length - 1]?.competencia;

  return (
    <div className="rounded-xl bg-brand-800 px-3.5 py-3">
      <p className="text-xs text-onbrand/45 mb-1">Média salarial de contribuição</p>
      <p className="text-lg font-semibold text-onbrand tabular-nums">
        {average != null ? formatBRL(average) : "—"} <span className="text-xs font-normal text-onbrand/45">/mês</span>
      </p>
      <p className="text-[11px] text-onbrand/45 mt-1">
        Calculada a partir de {distinctMonths} competência{distinctMonths === 1 ? "" : "s"} do Extrato do CNIS
        {first && last ? ` (${MONTH_LABEL.format(first)} – ${MONTH_LABEL.format(last)})` : ""}, já corrigida pela inflação.
      </p>
      <div className="flex items-center gap-3 mt-2.5">
        <CnisImportForm label="Importar novamente" variant="ghost" />
        <form action={clearSalaryHistoryAction}>
          <button type="submit" className="text-[11px] text-onbrand/45 hover:text-onbrand/70 underline flex items-center gap-1">
            <X className="h-3 w-3" /> Remover e usar valor manual
          </button>
        </form>
      </div>
    </div>
  );
}

/** Formulário de upload do Extrato do CNIS (PDF do Meu INSS) — mesmo padrão de ConnectAccountsStep/ContaClient. */
function CnisImportForm({ label = "Importar Extrato do CNIS (PDF)", variant = "secondary" }: { label?: string; variant?: "secondary" | "ghost" }) {
  const [state, formAction, pending] = useActionState<UploadCnisState, FormData>(uploadCnisAction, undefined);

  return (
    <form action={formAction} className={variant === "secondary" ? "rounded-xl bg-brand-800 px-3.5 py-3" : ""}>
      <label className="flex items-center gap-2 cursor-pointer text-xs text-onbrand/70">
        <input
          type="file"
          name="file"
          accept=".pdf"
          required
          className="block w-full text-onbrand/80 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-gold-500 file:text-ink-900 file:font-medium text-xs file:text-xs"
        />
      </label>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" size="sm" variant={variant === "ghost" ? "ghost" : undefined} loading={pending} className="mt-2">
        <Upload className="h-3.5 w-3.5" /> {pending ? "Lendo..." : label}
      </Button>
    </form>
  );
}

function MiniPctField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs text-onbrand/40 mb-1">{label}</p>
      <Input
        type="number"
        step={0.5}
        value={Math.round(value * 1000) / 10}
        onChange={(e) => onChange((Number(e.target.value) || 0) / 100)}
        className="h-9 text-sm px-2"
      />
    </div>
  );
}
