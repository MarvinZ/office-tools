import { db } from "@/db";
import { payrollUploads } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateId } from "@/lib/ids";

export async function checkDuplicateUpload(tenantId: string, fileHash: string) {
  const [existing] = await db
    .select()
    .from(payrollUploads)
    .where(
      and(
        eq(payrollUploads.tenantId, tenantId),
        eq(payrollUploads.fileHash, fileHash)
      )
    )
    .limit(1);

  return existing ?? null;
}

export async function createUpload(data: {
  tenantId: string;
  filename: string;
  blobUrl: string;
  fileHash: string;
  label?: string;
  createdBy: string;
}) {
  const [upload] = await db
    .insert(payrollUploads)
    .values({ id: generateId(), ...data })
    .returning();

  return upload;
}

export async function getUpload(id: string, tenantId: string) {
  const [upload] = await db
    .select()
    .from(payrollUploads)
    .where(and(eq(payrollUploads.id, id), eq(payrollUploads.tenantId, tenantId)))
    .limit(1);

  return upload ?? null;
}

export async function listUploads(tenantId: string) {
  return db
    .select()
    .from(payrollUploads)
    .where(eq(payrollUploads.tenantId, tenantId))
    .orderBy(payrollUploads.createdAt);
}
