import { db } from "@/db";
import { payrollBatches } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateId } from "@/lib/ids";

export type BatchStatus = typeof payrollBatches.$inferSelect["status"];

export async function createBatch(data: { tenantId: string; uploadId: string }) {
  const [batch] = await db
    .insert(payrollBatches)
    .values({
      id: generateId(),
      tenantId: data.tenantId,
      uploadId: data.uploadId,
      status: "draft",
    })
    .returning();

  return batch;
}

export async function getBatch(id: string, tenantId: string) {
  const [batch] = await db
    .select()
    .from(payrollBatches)
    .where(and(eq(payrollBatches.id, id), eq(payrollBatches.tenantId, tenantId)))
    .limit(1);

  return batch ?? null;
}

export async function updateBatchStatus(id: string, status: BatchStatus) {
  await db
    .update(payrollBatches)
    .set({ status, updatedAt: new Date() })
    .where(eq(payrollBatches.id, id));
}
