import type { CompassDimensionResult } from "@/services/compass";

const STATUS_TONE: Record<CompassDimensionResult["status"], string> = {
  Excelente: "text-ok-400",
  Saudável: "text-ok-400",
  "Em construção": "text-gold-400",
  Atenção: "text-danger-300",
};

/**
 * A literal compass dial for the overall Bússola score: a full ring with a
 * needle from the center, instead of a banded speedometer arc. The needle
 * angle and the gold fill both track `score` (0-100 mapped to 0-360deg,
 * clockwise from the top).
 */
export function CompassDial({
  score,
  status,
  size = 184,
}: {
  score: number;
  status: CompassDimensionResult["status"];
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const angle = (clamped / 100) * 360;
  const ringWidth = Math.round(size * 0.082);
  const needleLen = Math.round(size * 0.38);
  const tailLen = Math.round(size * 0.12);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(var(--color-gold-400) 0deg ${angle}deg, rgba(251,249,244,0.09) ${angle}deg 360deg)`,
        }}
      >
        <div className="absolute rounded-full bg-brand-800" style={{ inset: ringWidth }} />
        <div className="absolute left-1/2 top-1/2 h-0 w-0">
          <div style={{ transform: `rotate(${angle}deg)` }}>
            <div
              className="absolute"
              style={{
                left: -2.5,
                top: -needleLen,
                width: 5,
                height: needleLen,
                borderRadius: "3px 3px 0 0",
                background: "linear-gradient(var(--color-cream-50), var(--color-gold-400))",
                transformOrigin: "50% 100%",
              }}
            />
            <div
              className="absolute bg-gold-700"
              style={{ left: -3, top: 0, width: 6, height: tailLen, borderRadius: "0 0 3px 3px" }}
            />
            <div
              className="absolute rounded-full bg-gold-400"
              style={{ left: -7, top: -7, width: 14, height: 14, boxShadow: "0 0 0 4px var(--color-brand-800)" }}
            />
          </div>
        </div>
      </div>
      <div className="text-center mt-3.5">
        <span className="block font-sans font-medium text-4xl leading-none tracking-tight tabular-nums text-cream-50">
          {clamped}
        </span>
        <span className={`block text-xs font-semibold mt-1.5 ${STATUS_TONE[status]}`}>{status}</span>
      </div>
    </div>
  );
}
