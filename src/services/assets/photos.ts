import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assetPhotos } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type AssetPhotoRow = InferSelectModel<typeof assetPhotos>;

export async function addPhoto(
  tenantId: string,
  assetId: string,
  uploadedBy: string,
  blobUrl: string
): Promise<AssetPhotoRow> {
  const [row] = await db
    .insert(assetPhotos)
    .values({ id: crypto.randomUUID(), assetId, tenantId, blobUrl, uploadedBy })
    .returning();
  return row;
}

export async function deletePhoto(tenantId: string, photoId: string): Promise<void> {
  await db
    .delete(assetPhotos)
    .where(and(eq(assetPhotos.tenantId, tenantId), eq(assetPhotos.id, photoId)));
}
