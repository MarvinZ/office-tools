import { and, eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { db } from "@/db";
import { employeeDocuments } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type EmployeeDocumentRow = InferSelectModel<typeof employeeDocuments>;
export type EmployeeDocType = "contract" | "id_document" | "other";

export async function addEmployeeDocument(
  tenantId: string,
  employeeId: string,
  uploadedBy: string,
  data: { name: string; type: EmployeeDocType; blobUrl: string }
): Promise<EmployeeDocumentRow> {
  const [row] = await db
    .insert(employeeDocuments)
    .values({ id: crypto.randomUUID(), employeeId, tenantId, uploadedBy, ...data })
    .returning();
  return row;
}

export async function deleteEmployeeDocument(tenantId: string, documentId: string): Promise<void> {
  const [doc] = await db
    .select()
    .from(employeeDocuments)
    .where(and(eq(employeeDocuments.tenantId, tenantId), eq(employeeDocuments.id, documentId)));
  if (!doc) return;
  await del(doc.blobUrl);
  await db.delete(employeeDocuments).where(eq(employeeDocuments.id, documentId));
}
