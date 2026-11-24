"use server";

import { revalidatePath } from "next/cache";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { barbersAction } from "@/services/barbers/action";
import { applyPriceImport, previewPriceImport } from "@/services/barbers/price-import";
import { BarbersError } from "@/lib/barbers/errors";

const MAX_BYTES = 2 * 1024 * 1024;

async function readFile(formData: FormData): Promise<ArrayBuffer> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new BarbersError("chooseFiles");
  if (!/\.xlsx$/i.test(file.name)) throw new BarbersError("onlyXlsx", { name: file.name });
  if (file.size > MAX_BYTES) throw new BarbersError("fileTooLarge", { name: file.name });
  return file.arrayBuffer();
}

/** Read the file and show what would change; writes nothing. */
export async function previewPriceImportAction(formData: FormData) {
  return barbersAction(async () => {
    const { tenant } = await requireBarbersAccess(["configure"]);
    return previewPriceImport(tenant.id, await readFile(formData));
  });
}

export async function applyPriceImportAction(formData: FormData) {
  return barbersAction(async () => {
    const { tenant, userId } = await requireBarbersAccess(["configure"]);
    const result = await applyPriceImport(tenant.id, userId, await readFile(formData));
    for (const path of ["/barbers/price-import", "/barbers/services", "/barbers/products", "/barbers/locations", "/barbers"]) {
      revalidatePath(path);
    }
    return result;
  });
}
