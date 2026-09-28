import { Film, Play, Plus } from "lucide-react";

interface GifPlaceholderProps {
  /** Identificador estável do slot, útil pra saber qual arquivo substituir depois. */
  slot: string;
  title: string;
  description: string;
  /** Usa uma moldura mais larga/quadrada pra gravações de celular/WhatsApp. */
  ratio?: "video" | "wide" | "square";
  /** URL de um GIF/vídeo real já gravado. Quando informado, preenche a moldura. */
  src?: string;
  className?: string;
}

const ratioClasses: Record<NonNullable<GifPlaceholderProps["ratio"]>, string> = {
  video: "aspect-video",
  wide: "aspect-[2/1]",
  square: "aspect-[4/3]",
};

/**
 * Moldura reservada e claramente identificada pra uma gravação real do
 * produto. Pedido explícito do Thiago (28/09/2026): "os gifs vou criar
 * quando conseguirmos bater uns 99% da plataforma" — até lá, cada slot fica
 * visivelmente marcado como "reservado", nunca fingindo ser uma captura real.
 */
export default function GifPlaceholder({
  slot,
  title,
  description,
  ratio = "video",
  src,
  className = "",
}: GifPlaceholderProps) {
  const fileHint = `${slot}.gif`;

  return (
    <figure className={`lp-reveal min-w-0 ${className}`}>
      <div
        data-gif-slot={slot}
        className={`relative isolate overflow-hidden rounded-2xl border border-dashed border-gold-500/30 bg-[#111519] shadow-[0_24px_60px_-34px_rgba(0,0,0,.85)] transition-[transform,border-color,box-shadow] duration-200 ease-out hover:z-10 hover:border-gold-400/65 hover:shadow-[0_30px_72px_-30px_rgba(240,153,47,.25)] motion-safe:hover:scale-[1.025] ${ratioClasses[ratio]}`}
        role={src ? undefined : "img"}
        aria-label={src ? undefined : `Placeholder de GIF: ${title}. ${description}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- src pode ser uma gravação hospedada fora do domínio, sem largura/altura fixas conhecidas de antemão
          <img src={src} alt={title} className="absolute inset-0 size-full object-cover" loading="lazy" />
        ) : (
          <>
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(240,153,47,.1),transparent_55%)]"
              aria-hidden="true"
            />
            <div className="absolute inset-3 flex flex-col justify-between rounded-xl bg-[linear-gradient(145deg,rgba(255,255,255,.025),rgba(255,255,255,0))] p-3 sm:inset-4 sm:p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[0.59rem] font-medium uppercase tracking-[0.14em] text-brand-100/45">
                  <Film className="size-3.5 text-gold-400/80" aria-hidden="true" />
                  Janela de demonstração
                </span>
                <span className="rounded-full border border-gold-500/20 bg-gold-500/[0.07] px-2 py-1 text-[0.53rem] font-semibold uppercase tracking-[0.1em] text-gold-400/90">
                  GIF
                </span>
              </div>

              <div className="flex flex-col items-center justify-center text-center">
                <span className="mb-2.5 flex size-10 items-center justify-center rounded-full border border-gold-500/35 bg-gold-500/[0.08] text-gold-400 shadow-[0_0_28px_rgba(240,153,47,.12)] sm:size-12">
                  <Play className="ml-0.5 size-4 fill-current sm:size-[18px]" aria-hidden="true" />
                </span>
                <span className="font-display text-[0.78rem] font-semibold text-cream-50 sm:text-sm">
                  GIF real do Tobias entra aqui
                </span>
                <span className="mt-1 max-w-[24rem] text-[0.62rem] leading-relaxed text-brand-100/55 sm:text-[0.68rem]">
                  {description}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-black/20 text-brand-100/55">
                  <Plus className="size-3" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[0.57rem] text-brand-100/50">{fileHint}</span>
                <span className="shrink-0 text-[0.53rem] uppercase tracking-[0.1em] text-gold-400/75">reservado</span>
              </div>
            </div>
          </>
        )}
      </div>
      <figcaption className="mt-3">
        <p className="font-display text-[0.82rem] font-semibold text-cream-50">{title}</p>
        <p className="mt-1 text-[0.68rem] leading-relaxed text-brand-100/55">
          Quando disponível, o GIF real será exibido neste espaço.
        </p>
      </figcaption>
    </figure>
  );
}
