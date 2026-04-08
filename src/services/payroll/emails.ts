import { db } from "@/db";
import { payrollEmails } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateId } from "@/lib/ids";
import type { PayrollRow } from "@/lib/payroll/parser";

export async function createBatchEmails(
  batchId: string,
  tenantId: string,
  rows: PayrollRow[],
  recipientEmail: string
) {
  const values = rows.map((row) => ({
    id: generateId(),
    batchId,
    tenantId,
    recipientEmail,
    payload: row as unknown as Record<string, unknown>,
    status: "queued" as const,
  }));

  return db.insert(payrollEmails).values(values).returning();
}

export async function updateEmailStatus(
  id: string,
  status: "queued" | "sent" | "failed",
  error?: string
) {
  await db
    .update(payrollEmails)
    .set({
      status,
      sentAt: status === "sent" ? new Date() : undefined,
      error: error ?? null,
    })
    .where(eq(payrollEmails.id, id));
}

export async function getEmailsByBatch(batchId: string, tenantId: string) {
  return db
    .select()
    .from(payrollEmails)
    .where(
      and(
        eq(payrollEmails.batchId, batchId),
        eq(payrollEmails.tenantId, tenantId)
      )
    );
}
