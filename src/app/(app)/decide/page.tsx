import { requireOnboardedUser } from "@/lib/auth/guards";
import { DecideClient } from "./DecideClient";

export default async function DecidePage() {
  await requireOnboardedUser();
  return <DecideClient />;
}
