import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";

/** Use in Server Components/pages that require a logged-in user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Use in Server Components/pages that require a logged-in user who has
 * already finished onboarding. Everything past the first conversation
 * assumes a FinancialProfile exists — dashboards, budget, compass, etc.
 */
export async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.onboardingCompleted) redirect("/onboarding");
  return user;
}
