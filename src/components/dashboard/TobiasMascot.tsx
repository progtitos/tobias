import Image from "next/image";

export type TobiasMood = "ok" | "warn";

const MOOD_RING: Record<TobiasMood, string> = {
  ok: "tobias-mascot-mood-ok",
  warn: "tobias-mascot-mood-warn",
};

/**
 * A big, "alive" Tobias avatar that floats into a hero card's top-right
 * corner — always gently breathing, and reacting to hover/focus with a
 * stronger pulse plus a short mood line tied to that card's own data.
 * Positioning is absolute (see .tobias-mascot in globals.css), so the
 * parent Card needs `relative` and enough top clearance for the overlap.
 */
export function TobiasMascot({ src, mood, message }: { src: string; mood: TobiasMood; message: string }) {
  return (
    <div className="tobias-mascot" tabIndex={0} role="img" aria-label={`Tobias: ${message}`}>
      <div className={`tobias-mascot-ring ${MOOD_RING[mood]}`}>
        <Image src={src} alt="" width={64} height={64} />
      </div>
      <div className="tobias-mascot-bubble" aria-hidden="true">
        {message}
      </div>
    </div>
  );
}
