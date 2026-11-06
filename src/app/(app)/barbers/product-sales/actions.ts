"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createProductSale, deleteProductSale } from "@/services/barbers/product-sales";
import type { ProductSaleInput } from "@/services/barbers/product-sales";
import { auditBarbers } from "@/services/barbers/audit";

export async function createProductSaleAction(data: ProductSaleInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const row = await createProductSale(tenant.id, user.id, data);
  await auditBarbers(tenant.id, user.id, "productSale.created", {
    barberId: row.barberId,
    entityId: row.id,
    summary: { amount: Number(row.totalAmount), date: row.saleDate },
  });
  revalidatePath("/barbers/product-sales");
  return row;
}

export async function deleteProductSaleAction(id: string) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const row = await deleteProductSale(tenant.id, id);
  if (row) {
    await auditBarbers(tenant.id, user.id, "productSale.deleted", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { amount: Number(row.totalAmount), date: row.saleDate },
    });
  }
  revalidatePath("/barbers/product-sales");
}
