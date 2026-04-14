import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetPhotos, assetDocuments, assetHistory, employees } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type AssetRow = InferSelectModel<typeof assets>;
export type AssetPhotoRow = InferSelectModel<typeof assetPhotos>;
export type AssetDocumentRow = InferSelectModel<typeof assetDocuments>;
export type AssetHistoryRow = InferSelectModel<typeof assetHistory>;

export type AssetWithRelations = AssetRow & {
  photos: AssetPhotoRow[];
  documents: AssetDocumentRow[];
  history: AssetHistoryRow[];
  assignedEmployee: Pick<InferSelectModel<typeof employees>, "id" | "firstName" | "lastName"> | null;
};

export type AssetWithEmployee = AssetRow & {
  assignedEmployee: Pick<InferSelectModel<typeof employees>, "id" | "firstName" | "lastName"> | null;
};

export async function listAssets(tenantId: string): Promise<AssetWithEmployee[]> {
  const rows = await db
    .select({
      asset: assets,
      employee: {
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
      },
    })
    .from(assets)
    .leftJoin(employees, eq(assets.assignedToId, employees.id))
    .where(eq(assets.tenantId, tenantId))
    .orderBy(assets.createdAt);

  return rows.map((r) => ({
    ...r.asset,
    assignedEmployee: r.employee?.id ? r.employee : null,
  }));
}

export async function getAsset(tenantId: string, id: string): Promise<AssetWithRelations | null> {
  const rows = await db
    .select({
      asset: assets,
      employee: {
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
      },
    })
    .from(assets)
    .leftJoin(employees, eq(assets.assignedToId, employees.id))
    .where(and(eq(assets.tenantId, tenantId), eq(assets.id, id)));

  if (!rows[0]) return null;

  const { asset, employee } = rows[0];

  const [photos, documents, history] = await Promise.all([
    db.select().from(assetPhotos).where(eq(assetPhotos.assetId, id)).orderBy(assetPhotos.uploadedAt),
    db.select().from(assetDocuments).where(eq(assetDocuments.assetId, id)).orderBy(assetDocuments.uploadedAt),
    db.select().from(assetHistory).where(eq(assetHistory.assetId, id)).orderBy(assetHistory.createdAt),
  ]);

  return {
    ...asset,
    photos,
    documents,
    history,
    assignedEmployee: employee?.id ? employee : null,
  };
}

export async function createAsset(
  tenantId: string,
  createdBy: string,
  data: Omit<AssetRow, "id" | "tenantId" | "createdBy" | "createdAt" | "updatedAt">
): Promise<AssetRow> {
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(assets)
    .values({ ...data, id, tenantId, createdBy })
    .returning();
  return row;
}

export async function updateAsset(
  tenantId: string,
  id: string,
  data: Partial<Omit<AssetRow, "id" | "tenantId" | "createdBy" | "createdAt">>
): Promise<AssetRow | null> {
  const [row] = await db
    .update(assets)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(assets.tenantId, tenantId), eq(assets.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteAsset(tenantId: string, id: string): Promise<void> {
  await db.delete(assets).where(and(eq(assets.tenantId, tenantId), eq(assets.id, id)));
}
