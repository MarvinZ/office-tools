import { notFound } from "next/navigation";
import { DEV_TENANT_ID, DEV_ROW_LIMIT } from "@/lib/constants";
import { getBatch } from "@/services/payroll/batches";
import { getUpload } from "@/services/payroll/uploads";
import { parsePayrollFromUrl } from "@/lib/payroll/parser";
import BatchReview from "./_components/batch-review";

type Props = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ duplicate?: string }>;
};

export default async function BatchPage({ params, searchParams }: Props) {
  const { batchId } = await params;
  const { duplicate } = await searchParams;
  const tenantId = DEV_TENANT_ID;

  const batch = await getBatch(batchId, tenantId);
  if (!batch) notFound();

  const upload = await getUpload(batch.uploadId, tenantId);
  if (!upload) notFound();

  const allRows = await parsePayrollFromUrl(upload.blobUrl);
  const rows = allRows.slice(0, DEV_ROW_LIMIT); // TODO: remove limit

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">Review & Send</h1>
        <p className="mt-1 text-sm text-zinc-500">Verify the data below before sending emails.</p>
      </div>
      <BatchReview
        batchId={batchId}
        filename={upload.filename}
        rows={rows}
        isDuplicate={duplicate === "true"}
      />
    </div>
  );
}
