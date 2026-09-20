import { requireOnboardedUser } from "@/lib/auth/guards";
import { getLatestCompass } from "@/services/compass";
import { CompassClient } from "./CompassClient";

export default async function CompassPage() {
  const user = await requireOnboardedUser();
  // getLatestCompass computa ao vivo (ver comentário em services/compass.ts)
  // e sempre devolve as 9 dimensões, então não há mais "primeira visita sem
  // snapshot" pra tratar aqui.
  const dimensions = await getLatestCompass(user.id);
  const overallScore = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);

  return <CompassClient dimensions={dimensions} overallScore={overallScore} />;
}
