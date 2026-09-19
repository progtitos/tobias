import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentAdmin, type SessionUser } from "./session";

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

/**
 * Use only inside `(admin)/admin/(protected)` — the group of pages that
 * actually needs staff access. Checks the SEPARATE admin session
 * (`tobias_admin_session`, see session.ts), not the regular app login: being
 * logged into Tobias as a customer — even on an account with
 * `role: "ADMIN"` — never grants this by itself. Redirects to `/admin/login`,
 * never to the customer `/login`, so the two flows never mix.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
