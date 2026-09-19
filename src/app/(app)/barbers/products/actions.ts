"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createProduct, updateProduct } from "@/services/barbers/products";
import type { ProductInput } from "@/services/barbers/products";

export async function createProductAction(data: ProductInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await createProduct(tenant.id, user.id, data);
  revalidatePath("/barbers/products");
}

export async function updateProductAction(id: string, data: Partial<ProductInput>) {
  const tenant = await requireTenant();
  await updateProduct(tenant.id, id, data);
  revalidatePath("/barbers/products");
}
