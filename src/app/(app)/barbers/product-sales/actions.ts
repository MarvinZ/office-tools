"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createProductSale, deleteProductSale } from "@/services/barbers/product-sales";
import type { ProductSaleInput } from "@/services/barbers/product-sales";

export async function createProductSaleAction(data: ProductSaleInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const row = await createProductSale(tenant.id, user.id, data);
  revalidatePath("/barbers/product-sales");
  return row;
}

export async function deleteProductSaleAction(id: string) {
  const tenant = await requireTenant();
  await deleteProductSale(tenant.id, id);
  revalidatePath("/barbers/product-sales");
}
