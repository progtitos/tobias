import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import { trackEvent, logFinancialEvent } from "./analytics";
import type { CreateAssetInput } from "@/lib/validations/asset";

export async function listAssets(userId: string) {
  return db.select().from(assets).where(eq(assets.userId, userId)).orderBy(assets.createdAt);
}

export async function createAsset(userId: string, input: CreateAssetInput) {
  const [asset] = await db
    .insert(assets)
    .values({
      userId,
      name: input.name,
      type: input.type,
      estimatedValue: input.estimatedValue,
      acquiredAt: input.acquiredAt ? new Date(input.acquiredAt) : null,
      notes: input.notes || null,
    })
    .returning();

  await trackEvent(userId, "asset_created", { type: input.type });
  await logFinancialEvent(userId, "asset_created", { assetId: asset.id, name: input.name });
  return asset;
}

/** Reajuste de valor estimado (ex: reavaliação do imóvel/carro) — não mexe em mais nada do bem. */
export async function updateAssetValue(userId: string, assetId: string, estimatedValue: number) {
  const [asset] = await db
    .update(assets)
    .set({ estimatedValue, updatedAt: new Date() })
    .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
    .returning();

  if (asset) {
    await trackEvent(userId, "asset_updated", { assetId, estimatedValue });
    await logFinancialEvent(userId, "asset_value_updated", { assetId, estimatedValue });
  }
  return asset;
}

export async function deleteAsset(userId: string, assetId: string) {
  await db.delete(assets).where(and(eq(assets.id, assetId), eq(assets.userId, userId)));
  await trackEvent(userId, "asset_deleted", { assetId });
}
