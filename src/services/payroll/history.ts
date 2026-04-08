import { db } from "@/db";
import { payrollBatches, payrollUploads, payrollEmails } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getBatchHistory(tenantId: string) {
  const batches = await db
    .select({
      batchId: payrollBatches.id,
      status: payrollBatches.status,
      createdAt: payrollBatches.createdAt,
      filename: payrollUploads.filename,
      uploadId: payrollUploads.id,
    })
    .from(payrollBatches)
    .innerJoin(payrollUploads, eq(payrollBatches.uploadId, payrollUploads.id))
    .where(eq(payrollBatches.tenantId, tenantId))
    .orderBy(desc(payrollBatches.createdAt));

  return batches;
}

export async function getBatchWithEmails(batchId: string, tenantId: string) {
  const [batch] = await db
    .select({
      batchId: payrollBatches.id,
      status: payrollBatches.status,
      createdAt: payrollBatches.createdAt,
      filename: payrollUploads.filename,
    })
    .from(payrollBatches)
    .innerJoin(payrollUploads, eq(payrollBatches.uploadId, payrollUploads.id))
    .where(eq(payrollBatches.id, batchId))
    .limit(1);

  if (!batch) return null;

  const emails = await db
    .select()
    .from(payrollEmails)
    .where(eq(payrollEmails.batchId, batchId));

  return { ...batch, emails };
}
