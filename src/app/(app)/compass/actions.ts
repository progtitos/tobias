"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { saveCompassSnapshot } from "@/services/compass";

export async function recalculateCompassAction() {
  const user = await requireOnboardedUser();
  await saveCompassSnapshot(user.id);
  revalidatePath("/compass");
  revalidatePath("/dashboard");
}
