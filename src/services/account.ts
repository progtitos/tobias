import "server-only";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, sessions, financialEvents } from "@/lib/db/schema";
import { trackEvent } from "./analytics";

/**
 * Hard-deletes the user row. Every other table references users.id with
 * onDelete: "cascade" (transactions, goals, receipts, conversations, the
 * lot), so this one delete removes every piece of the person's financial
 * data — real deletion, not a hidden flag. analytics_events is the one
 * exception (onDelete: "set null"), which is deliberate: it keeps aggregate
 * product metrics (e.g. "how many people delete their account") without
 * retaining anything that identifies who.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await trackEvent(userId, "account_deleted");
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

/** Recent audit trail of significant account/financial changes (spec §28). */
export async function getRecentActivity(userId: string, limit = 50) {
  return db
    .select()
    .from(financialEvents)
    .where(eq(financialEvents.userId, userId))
    .orderBy(desc(financialEvents.createdAt))
    .limit(limit);
}
