"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createProduct, updateProduct } from "@/services/barbers/products";
import type { ProductInput } from "@/services/barbers/products";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { BarbersError } from "@/lib/barbers/errors";
import { barbersAction } from "@/services/barbers/action";

export async function createProductAction(data: ProductInput) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
    if (!user) throw new BarbersError("notAuthenticated");
    await createProduct(tenant.id, user.id, data);
    revalidatePath("/barbers/products");
  });
}

export async function updateProductAction(id: string, data: Partial<ProductInput>) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    const tenant = await requireTenant();
    await updateProduct(tenant.id, id, data);
    revalidatePath("/barbers/products");
  });
}
