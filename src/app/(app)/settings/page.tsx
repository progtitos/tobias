import { eq } from "drizzle-orm";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const user = await requireOnboardedUser();
  const [full] = await db
    .select({ cpf: users.cpf, phone: users.phone, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <SettingsClient
      user={{
        name: user.name,
        email: user.email,
        cpf: full?.cpf ?? null,
        phone: full?.phone ?? null,
        memberSince: (full?.createdAt ?? new Date()).toISOString(),
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt.toISOString(),
      }}
    />
  );
}
