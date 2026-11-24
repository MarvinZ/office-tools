"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import {
  importClosings,
  loadImportContext,
  previewClosings,
  type ClosingDecisions,
  type ClosingPreview,
  type ClosingUpload,
  type ImportResult,
} from "@/services/barbers/closing-imports";

const MAX_FILES = 31;
const MAX_BYTES = 2 * 1024 * 1024;

async function readUploads(formData: FormData): Promise<ClosingUpload[]> {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Choose at least one closing file.");
  if (files.length > MAX_FILES) throw new Error(`At most ${MAX_FILES} files at a time.`);
  return Promise.all(
    files.map(async (f) => {
      if (!/\.xlsx$/i.test(f.name)) throw new Error(`${f.name}: only .xlsx files are accepted.`);
      if (f.size > MAX_BYTES) throw new Error(`${f.name}: the file is too large.`);
      return { name: f.name, bytes: await f.arrayBuffer() };
    })
  );
}

function readDecisions(formData: FormData): ClosingDecisions {
  try {
    return JSON.parse(String(formData.get("decisions") ?? "{}")) as ClosingDecisions;
  } catch {
    return {};
  }
}

export type PreviewResponse = {
  previews: ClosingPreview[];
  missingMethodCodes: string[];
};

/** Parse and check the files; writes nothing. */
export async function previewClosingsAction(formData: FormData): Promise<PreviewResponse> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated.");
  const tenant = await requireTenant();
  const locationId = String(formData.get("locationId") ?? "");
  const [uploads, context] = await Promise.all([readUploads(formData), loadImportContext(tenant.id)]);
  const previews = await previewClosings(tenant.id, locationId, uploads, readDecisions(formData), context);
  return { previews, missingMethodCodes: context.missingMethodCodes };
}

/** Import the ready files. Replaces earlier imports of the same dates, so admins only. */
export async function importClosingsAction(formData: FormData): Promise<ImportResult[]> {
  const { userId, orgRole } = await auth();
  if (!userId) throw new Error("Not authenticated.");
  if (orgRole !== "org:admin") throw new Error("Only an admin can import closings.");
  const tenant = await requireTenant();
  const locationId = String(formData.get("locationId") ?? "");
  const results = await importClosings(tenant.id, userId, locationId, await readUploads(formData), readDecisions(formData));
  for (const path of ["/barbers/imports", "/barbers", "/barbers/reports", "/barbers/settlements", "/barbers/vales", "/barbers/product-sales"]) {
    revalidatePath(path);
  }
  return results;
}
