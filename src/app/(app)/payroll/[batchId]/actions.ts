"use server";

import { DEV_TENANT_ID, DEV_EMAIL_OVERRIDE, DEV_ROW_LIMIT } from "@/lib/constants";
import { parsePayrollFromUrl } from "@/lib/payroll/parser";
import { buildPayrollEmail } from "@/lib/payroll/email-template";
import { getBatch, updateBatchStatus } from "@/services/payroll/batches";
import { getUpload } from "@/services/payroll/uploads";
import { createBatchEmails, updateEmailStatus } from "@/services/payroll/emails";
import { resend } from "@/lib/resend";

export type SendResult = {
  sent: number;
  failed: number;
};

export async function sendPayrollBatch(batchId: string): Promise<SendResult | { error: string }> {
  const tenantId = DEV_TENANT_ID; // TODO: resolve from Clerk org

  const batch = await getBatch(batchId, tenantId);
  if (!batch) return { error: "Batch not found." };
  if (batch.status !== "draft") return { error: "Batch has already been processed." };

  const upload = await getUpload(batch.uploadId, tenantId);
  if (!upload) return { error: "Upload not found." };

  // Parse file from blob
  const allRows = await parsePayrollFromUrl(upload.blobUrl);
  const rows = allRows.slice(0, DEV_ROW_LIMIT); // TODO: remove limit

  if (!rows.length) return { error: "No rows found in file." };

  // Create email records in DB
  const emailRecords = await createBatchEmails(
    batchId,
    tenantId,
    rows,
    DEV_EMAIL_OVERRIDE // TODO: use row.email once column exists
  );

  // Mark batch as processing
  await updateBatchStatus(batchId, "processing");

  let sent = 0;
  let failed = 0;

  // Send each email and update status
  for (const [i, row] of rows.entries()) {
    const emailRecord = emailRecords[i];

    const { error } = await resend.emails.send({
      from: "OfficeTools <onboarding@resend.dev>",
      to: DEV_EMAIL_OVERRIDE,
      subject: `Comprobante de pago — ${row.empleado}`,
      html: buildPayrollEmail(row),
    });

    if (error) {
      await updateEmailStatus(emailRecord.id, "failed", error.message);
      failed++;
    } else {
      await updateEmailStatus(emailRecord.id, "sent");
      sent++;
    }
  }

  // Final batch status
  await updateBatchStatus(batchId, failed === rows.length ? "failed" : "sent");

  return { sent, failed };
}
