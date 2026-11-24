"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createProductSale, deleteProductSale } from "@/services/barbers/product-sales";
import type { ProductSaleInput } from "@/services/barbers/product-sales";
import { auditBarbers } from "@/services/barbers/audit";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { BarbersError } from "@/lib/barbers/errors";
import { barbersAction } from "@/services/barbers/action";

export async function createProductSaleAction(data: ProductSaleInput) {
  return barbersAction(async () => {
    await requireBarbersAccess(["operate"]);
    const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
    if (!user) throw new BarbersError("notAuthenticated");
    const row = await createProductSale(tenant.id, user.id, data);
    await auditBarbers(tenant.id, user.id, "productSale.created", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { amount: Number(row.totalAmount), date: row.saleDate },
    });
    revalidatePath("/barbers/product-sales");
    return row;
  });
}

export async function deleteProductSaleAction(id: string) {
  return barbersAction(async () => {
    await requireBarbersAccess(["operate"]);
    const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
    if (!user) throw new BarbersError("notAuthenticated");
    const row = await deleteProductSale(tenant.id, id);
    if (row) {
      await auditBarbers(tenant.id, user.id, "productSale.deleted", {
        barberId: row.barberId,
        entityId: row.id,
        summary: { amount: Number(row.totalAmount), date: row.saleDate },
      });
    }
    revalidatePath("/barbers/product-sales");
  });
}
