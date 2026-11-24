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
} from "@/services/barbers/closing-imports";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { BarbersError } from "@/lib/barbers/errors";
import { barbersAction } from "@/services/barbers/action";

const MAX_FILES = 31;
const MAX_BYTES = 2 * 1024 * 1024;

async function readUploads(formData: FormData): Promise<ClosingUpload[]> {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new BarbersError("chooseFiles");
  if (files.length > MAX_FILES) throw new BarbersError("tooManyFiles", { max: MAX_FILES });
  return Promise.all(
    files.map(async (f) => {
      if (!/\.xlsx$/i.test(f.name)) throw new BarbersError("onlyXlsx", { name: f.name });
      if (f.size > MAX_BYTES) throw new BarbersError("fileTooLarge", { name: f.name });
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
export async function previewClosingsAction(formData: FormData) {
  return barbersAction(async () => {
    await requireBarbersAccess(["operate", "view"]);
    const { userId } = await auth();
    if (!userId) throw new BarbersError("notAuthenticated");
    const tenant = await requireTenant();
    const locationId = String(formData.get("locationId") ?? "");
    const [uploads, context] = await Promise.all([readUploads(formData), loadImportContext(tenant.id)]);
    const previews = await previewClosings(tenant.id, locationId, uploads, readDecisions(formData), context);
    return { previews, missingMethodCodes: context.missingMethodCodes };
  });
}

/** Import the ready files. Replaces earlier imports of the same dates, so admins only. */
export async function importClosingsAction(formData: FormData) {
  return barbersAction(async () => {
    const { userId, tenant } = await requireBarbersAccess(["configure"]);
    const locationId = String(formData.get("locationId") ?? "");
    const results = await importClosings(tenant.id, userId, locationId, await readUploads(formData), readDecisions(formData));
    for (const path of ["/barbers/imports", "/barbers", "/barbers/reports", "/barbers/settlements", "/barbers/vales", "/barbers/product-sales"]) {
      revalidatePath(path);
    }
    return results;
  });
}
