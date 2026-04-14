import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assetDocuments } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type AssetDocumentRow = InferSelectModel<typeof assetDocuments>;
export type AssetDocumentType = "invoice" | "manual" | "warranty" | "other";

export async function addDocument(
  tenantId: string,
  assetId: string,
  uploadedBy: string,
  data: { name: string; type: AssetDocumentType; blobUrl: string }
): Promise<AssetDocumentRow> {
  const [row] = await db
    .insert(assetDocuments)
    .values({ id: crypto.randomUUID(), assetId, tenantId, uploadedBy, ...data })
    .returning();
  return row;
}

export async function deleteDocument(tenantId: string, documentId: string): Promise<void> {
  await db
    .delete(assetDocuments)
    .where(and(eq(assetDocuments.tenantId, tenantId), eq(assetDocuments.id, documentId)));
}
