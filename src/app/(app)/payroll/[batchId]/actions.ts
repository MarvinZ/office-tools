"use server";

import { headers } from "next/headers";
import { DEV_TENANT_ID, DEV_EMAIL_OVERRIDE, DEV_ROW_LIMIT } from "@/lib/constants";
import { parsePayrollFromUrl } from "@/lib/payroll/parser";
import { getBatch, updateBatchStatus } from "@/services/payroll/batches";
import { getUpload } from "@/services/payroll/uploads";
import { createBatchEmails } from "@/services/payroll/emails";
import { qstash } from "@/lib/qstash";

export type QueueResult = { queued: number };

export async function sendPayrollBatch(
  batchId: string
): Promise<QueueResult | { error: string }> {
  const tenantId = DEV_TENANT_ID; // TODO: resolve from Clerk org

  const batch = await getBatch(batchId, tenantId);
  if (!batch) return { error: "Batch not found." };
  if (batch.status !== "draft") return { error: "Batch has already been processed." };

  const upload = await getUpload(batch.uploadId, tenantId);
  if (!upload) return { error: "Upload not found." };

  const allRows = await parsePayrollFromUrl(upload.blobUrl);
  const rows = allRows.slice(0, DEV_ROW_LIMIT); // TODO: remove limit
  if (!rows.length) return { error: "No rows found in file." };

  // Create one email record per row
  const emailRecords = await createBatchEmails(
    batchId,
    tenantId,
    rows,
    DEV_EMAIL_OVERRIDE // TODO: use row.email once column exists
  );

  // Mark batch as queued
  await updateBatchStatus(batchId, "queued");

  // Resolve the base URL for the worker
  const headersList = await headers();
  const host = headersList.get("host")!;
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  // Fan-out: one QStash message per email
  await qstash.batchJSON(
    emailRecords.map((record) => ({
      url: `${baseUrl}/api/workers/payroll/send-email`,
      body: { emailId: record.id },
    }))
  );

  return { queued: emailRecords.length };
}
