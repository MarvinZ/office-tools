import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assetHistory } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type AssetHistoryRow = InferSelectModel<typeof assetHistory>;
export type AssetHistoryAction =
  | "created"
  | "checked_out"
  | "checked_in"
  | "maintenance_start"
  | "maintenance_end"
  | "updated"
  | "document_added"
  | "photo_added";

export async function logHistory(
  tenantId: string,
  assetId: string,
  user: string,
  action: AssetHistoryAction,
  notes?: string
): Promise<AssetHistoryRow> {
  const [row] = await db
    .insert(assetHistory)
    .values({ id: crypto.randomUUID(), assetId, tenantId, action, user, notes: notes ?? null })
    .returning();
  return row;
}

export async function getHistory(assetId: string): Promise<AssetHistoryRow[]> {
  return db
    .select()
    .from(assetHistory)
    .where(eq(assetHistory.assetId, assetId))
    .orderBy(assetHistory.createdAt);
}
