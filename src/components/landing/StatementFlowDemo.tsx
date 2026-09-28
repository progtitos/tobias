import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleCheck,
  FileSpreadsheet,
  Merge,
  MoreHorizontal,
  Sparkles,
  Upload,
} from "lucide-react";

const entries = [
  {
    id: "market-original",
    name: "Mercado do Bairro",
    date: "Hoje, 10:42",
    amount: "− R$ 186,40",
    category: "Alimentação",
    type: "food",
  },
  {
    id: "market-duplicate",
    name: "Mercado do Bairro",
    date: "Hoje, 10:42",
    amount: "− R$ 186,40",
    category: "Possível duplicado",
    type: "food",
  },
  {
    id: "gas-station",
    name: "Posto Avenida",
    date: "Ontem, 18:16",
    amount: "− R$ 250,00",
    category: "Transporte",
    type: "travel",
  },
];

const categoryTone: Record<string, string> = {
  food: "bg-[#f0992f]/10 text-[#ffb648] border-[#f0992f]/20",
  travel: "bg-[#58b3d0]/10 text-[#79cce5] border-[#58b3d0]/20",
};

/**
 * Storyboard de interface animado, ILUSTRATIVO (não é gravação do produto):
 * extrato importado -> duplicidade sinalizada -> categorias aplicadas pela IA.
 * Fica no lugar de um GIF real até o Thiago gravar um (ver GifPlaceholder e
 * o combinado em 28/09/2026: "os gifs vou criar quando conseguirmos bater
 * uns 99% da plataforma").
 */
export default function StatementFlowDemo() {
  return (
    <div className="relative mx-auto w-full max-w-[570px]">
      <div
        className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(240,153,47,.13),transparent_70%)] blur-2xl"
        aria-hidden="true"
      />

      <div className="overflow-hidden rounded-[1.35rem] bg-[#191e23] shadow-[0_36px_100px_-34px_rgba(0,0,0,.9)]">
        {/* barra de janela */}
        <div className="flex items-center justify-between bg-black/15 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#f16d62]/80" />
            <span className="size-2.5 rounded-full bg-[#f4c352]/80" />
            <span className="size-2.5 rounded-full bg-[#5ecbb8]/80" />
            <span className="ml-3 font-sans text-[0.68rem] font-medium tracking-wide text-[#dfe3e6]/60">
              Meu planejamento
            </span>
          </div>
          <MoreHorizontal className="size-4 text-[#dfe3e6]/45" aria-hidden="true" />
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm font-semibold text-[#f5f6f5]">Lançamentos recentes</p>
              <p className="mt-1 text-[0.68rem] text-[#a6acb1]">Extrato importado · pronto para revisar</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-[#5ecbb8]/20 bg-[#5ecbb8]/[0.08] px-2.5 py-1 text-[0.65rem] font-medium text-[#5ecbb8]">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#5ecbb8]/60" />
                <span className="relative size-1.5 rounded-full bg-[#5ecbb8]" />
              </span>
              importado
            </div>
          </div>

          <div className="lp-upload-demo mt-4 flex items-center gap-3 rounded-xl border border-dashed border-[#f0992f]/35 bg-[#f0992f]/[0.055] px-3 py-2.5 sm:px-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f0992f]/[0.12] text-[#ffb648]">
              <FileSpreadsheet className="size-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.71rem] font-medium text-[#f5f6f5]">Extrato da conta</span>
              <span className="mt-0.5 block text-[0.62rem] text-[#a6acb1]">
                Extrato importado · lançamentos prontos para revisar
              </span>
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[#5ecbb8]/10 px-2 py-1 text-[0.61rem] font-medium text-[#5ecbb8]">
              <Check className="size-3" aria-hidden="true" />
              Concluído
            </span>
          </div>

          <div className="lp-duplicate-demo mt-3 flex items-center gap-3 rounded-xl border border-[#e3aa4e]/25 bg-[#e3aa4e]/[0.07] px-3 py-2.5 sm:px-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e3aa4e]/10 text-[#e3aa4e]">
              <Merge className="size-[17px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.7rem] font-medium text-[#f5f6f5]">
                2 lançamentos possivelmente duplicados
              </span>
              <span className="mt-0.5 block truncate text-[0.62rem] text-[#a6acb1]">Compra no mercado · R$ 186,40</span>
            </span>
            <span className="lp-merge-action whitespace-nowrap rounded-lg border border-[#e3aa4e]/30 px-2 py-1 text-[0.6rem] font-semibold text-[#ffb648]">
              Revisar e mesclar
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl bg-black/10">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-[0.63rem] font-medium uppercase tracking-[0.12em] text-[#a6acb1]">Transações</span>
              <span className="flex items-center gap-1 text-[0.62rem] text-[#a6acb1]">
                Este mês
                <ChevronDown className="size-3" aria-hidden="true" />
              </span>
            </div>
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className={`lp-transaction-row flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-3.5 ${i % 2 === 1 ? "bg-black/10" : ""}`}
                style={{ animationDelay: `${i * 260}ms` }}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/20 text-[#dfe3e6]/70">
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.68rem] font-medium text-[#f5f6f5]">{entry.name}</span>
                  <span className="mt-0.5 block text-[0.59rem] text-[#a6acb1]/75">{entry.date}</span>
                </span>
                <span
                  className={`hidden rounded-md border px-2 py-1 text-[0.58rem] sm:inline-flex ${
                    entry.category === "Possível duplicado"
                      ? "border-[#e3aa4e]/25 bg-[#e3aa4e]/[0.08] text-[#e3aa4e]"
                      : categoryTone[entry.type]
                  }`}
                >
                  {entry.category}
                </span>
                <span className="w-[4.6rem] shrink-0 text-right text-[0.66rem] font-medium text-[#f5f6f5] sm:w-[5.3rem]">
                  {entry.amount}
                </span>
              </div>
            ))}
          </div>

          <div className="lp-category-demo mt-3 overflow-hidden rounded-xl border border-violet-500/35 bg-[linear-gradient(120deg,rgba(169,155,232,.13),rgba(169,155,232,.04)_72%)] shadow-[0_10px_32px_-24px_rgba(169,155,232,.75)]">
            <div className="flex items-center justify-between gap-3 border-b border-violet-500/15 px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/[0.13] text-violet-400">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.68rem] font-semibold text-[#f5f3ff]">
                    Categorização automática por IA
                  </span>
                  <span className="mt-0.5 block text-[0.57rem] text-[#d1caef]/70">
                    Sugestões organizadas para você revisar
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[0.56rem] font-semibold text-violet-400">
                <Sparkles className="size-3" aria-hidden="true" />
                IA
              </span>
            </div>
            <div className="grid gap-1.5 p-2.5 sm:grid-cols-2">
              <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-2">
                <span className="min-w-0 truncate text-[0.59rem] text-[#dfe3e6]/80">Mercado do Bairro</span>
                <span className="shrink-0 rounded-md border border-[#f0992f]/20 bg-[#f0992f]/[0.08] px-1.5 py-1 text-[0.53rem] text-[#ffbf68]">
                  Alimentação
                </span>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-2">
                <span className="min-w-0 truncate text-[0.59rem] text-[#dfe3e6]/80">Posto Avenida</span>
                <span className="shrink-0 rounded-md border border-[#58b3d0]/20 bg-[#58b3d0]/[0.08] px-1.5 py-1 text-[0.53rem] text-[#79cce5]">
                  Transporte
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 pb-2.5 text-[0.56rem] text-[#d1caef]/65">
              <CircleCheck className="size-3 text-violet-400" aria-hidden="true" />
              Confira ou ajuste as categorias antes de seguir
            </div>
          </div>
        </div>
      </div>

      <div className="lp-float-chip absolute -bottom-5 -left-3 hidden items-center gap-2 rounded-xl bg-[#23292f] px-3 py-2.5 shadow-xl sm:flex">
        <span className="flex size-7 items-center justify-center rounded-lg bg-[#5ecbb8]/10 text-[#5ecbb8]">
          <Upload className="size-3.5" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-[0.62rem] font-medium text-[#f5f6f5]">Extrato importado</span>
          <span className="block text-[0.55rem] text-[#a6acb1]">Lançamentos no planejamento</span>
        </span>
        <ArrowUpRight className="ml-1 size-3.5 text-[#a6acb1]" aria-hidden="true" />
      </div>
      <div className="lp-float-chip lp-float-chip-late absolute -right-2 top-1/3 hidden items-center gap-2 rounded-xl bg-[#23292f] px-3 py-2.5 shadow-xl md:flex">
        <span className="flex size-7 items-center justify-center rounded-lg bg-[#f0992f]/10 text-[#ffb648]">
          <Merge className="size-3.5" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-[0.62rem] font-medium text-[#f5f6f5]">Duplicidades</span>
          <span className="block text-[0.55rem] text-[#a6acb1]">detectadas para revisão</span>
        </span>
      </div>

      <style>{`
        .lp-transaction-row { animation: lp-row-in 520ms cubic-bezier(.23,1,.32,1) both; }
        .lp-upload-demo { animation: lp-border-glow 5s ease-in-out infinite; }
        .lp-duplicate-demo { animation: lp-soft-alert 5s ease-in-out infinite; }
        .lp-category-demo { animation: lp-soft-violet 5s ease-in-out infinite; }
        .lp-merge-action { animation: lp-action-glow 5s ease-in-out infinite; }
        .lp-float-chip { animation: lp-bob 5.5s ease-in-out infinite; }
        .lp-float-chip-late { animation-delay: -2.4s; }
        @keyframes lp-row-in { from { opacity: .2; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes lp-border-glow { 0%, 100% { border-color: rgba(240,153,47,.25); } 35%, 60% { border-color: rgba(240,153,47,.58); } }
        @keyframes lp-soft-alert { 0%, 28%, 100% { background: rgba(227,170,78,.04); } 38%, 60% { background: rgba(227,170,78,.12); } }
        @keyframes lp-soft-violet { 0%, 55%, 100% { background: rgba(169,155,232,.035); } 68%, 88% { background: rgba(169,155,232,.09); } }
        @keyframes lp-action-glow { 0%, 28%, 100% { box-shadow: 0 0 0 rgba(227,170,78,0); } 38%, 60% { box-shadow: 0 0 18px rgba(227,170,78,.18); } }
        @keyframes lp-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @media (prefers-reduced-motion: reduce) { .lp-transaction-row, .lp-upload-demo, .lp-duplicate-demo, .lp-category-demo, .lp-merge-action, .lp-float-chip { animation: none !important; } }
      `}</style>
    </div>
  );
}
