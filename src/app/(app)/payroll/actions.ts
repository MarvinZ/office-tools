"use server";

import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { DEV_TENANT_ID } from "@/lib/constants";
import { checkDuplicateUpload, createUpload } from "@/services/payroll/uploads";
import { createBatch } from "@/services/payroll/batches";

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function uploadPayrollFile(formData: FormData): Promise<
  | { batchId: string; isDuplicate?: boolean }
  | { error: string }
> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const file = formData.get("file") as File;
  if (!file || file.size === 0) return { error: "No file provided." };

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "xlsx" && ext !== "xls") return { error: "Only .xlsx or .xls files are accepted." };

  const buffer = await file.arrayBuffer();
  const fileHash = await hashBuffer(buffer);
  const tenantId = DEV_TENANT_ID; // TODO: resolve from Clerk org

  // Duplicate detection
  const duplicate = await checkDuplicateUpload(tenantId, fileHash);
  if (duplicate) {
    // Still create a new batch for the duplicate — just warn the user
    const batch = await createBatch({ tenantId, uploadId: duplicate.id });
    return { batchId: batch.id, isDuplicate: true };
  }

  // Upload to Vercel Blob
  const blob = await put(`payroll/${tenantId}/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  // Persist to DB
  const upload = await createUpload({
    tenantId,
    filename: file.name,
    blobUrl: blob.url,
    fileHash,
    createdBy: userId,
  });

  const batch = await createBatch({ tenantId, uploadId: upload.id });

  return { batchId: batch.id };
}
