import "server-only";
import { db } from "@/lib/db/client";
import { analyticsEvents, financialEvents } from "@/lib/db/schema";

// Event names per product spec §45. Kept as a union so callers get
// autocomplete/typo-safety; the table itself just stores free text so adding
// a new event later is additive.
export type AnalyticsEventName =
  | "signup_started"
  | "signup_completed"
  | "login"
  | "logout"
  | "onboarding_started"
  | "onboarding_message"
  | "onboarding_completed"
  | "expense_created"
  | "receipt_uploaded"
  | "receipt_processed"
  | "receipt_confirmed"
  | "goal_created"
  | "goal_updated"
  | "bank_account_created"
  | "bank_account_updated"
  | "investment_created"
  | "investment_updated"
  | "retirement_plan_created"
  | "retirement_plan_simulated"
  | "chat_message"
  | "insight_viewed"
  | "insight_generated"
  | "alert_generated"
  | "budget_created"
  | "budget_overrun_detected"
  | "affordability_check"
  | "trial_started"
  | "trial_expiring_soon"
  | "trial_expired"
  | "subscription_started"
  | "account_deleted";

/**
 * Fire-and-forget product analytics. Never throws into the caller — a
 * logging failure should never break the user-facing action that triggered
 * it. This is intentionally just a table today (see spec §45/§46); the shape
 * (name + userId + JSON properties + timestamp) is exactly what a real
 * pipeline (PostHog/Amplitude/Segment) would want later, so swapping the
 * sink is additive, not a rewrite.
 */
export async function trackEvent(
  userId: string | null,
  name: AnalyticsEventName,
  properties?: Record<string, unknown>
) {
  try {
    await db.insert(analyticsEvents).values({ userId, name, properties: properties ?? null });
  } catch (err) {
    console.error("[analytics] failed to record event", name, err);
  }
}

/** Audit-trail log for significant, user-visible financial changes (spec §28). */
export async function logFinancialEvent(
  userId: string,
  type: string,
  payload?: Record<string, unknown>
) {
  try {
    await db.insert(financialEvents).values({ userId, type, payload: payload ?? null });
  } catch (err) {
    console.error("[financial-event] failed to record", type, err);
  }
}
