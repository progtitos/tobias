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

/**
 * Use in the (admin) route group only. Redirects a logged-out visitor to
 * /login same as requireUser, but sends anyone who IS logged in and just
 * isn't staff back to their own dashboard instead of a generic 403 — no
 * point telling a curious end user this area exists at all.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
