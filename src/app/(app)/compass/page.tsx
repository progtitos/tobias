import { requireOnboardedUser } from "@/lib/auth/guards";
import { getLatestCompass, saveCompassSnapshot } from "@/services/compass";
import { CompassClient } from "./CompassClient";

export default async function CompassPage() {
  const user = await requireOnboardedUser();
  let dimensions = await getLatestCompass(user.id);

  // First visit: there's no snapshot yet, so compute one now instead of
  // showing an empty page. Subsequent visits use the stored snapshot and
  // only recompute when the user asks (via the "Recalcular" button) — this
  // keeps the compass reproducible/auditable rather than silently drifting
  // on every page load.
  if (dimensions.length === 0) {
    dimensions = await saveCompassSnapshot(user.id);
  }

  const overallScore =
    dimensions.length > 0 ? Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length) : 0;

  return <CompassClient dimensions={dimensions} overallScore={overallScore} />;
}
