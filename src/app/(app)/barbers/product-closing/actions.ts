"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import {
  createCustomerSale,
  deleteCustomerSale,
  markCommissionsPaid,
  unmarkCommissionPaid,
  type CustomerSaleInput,
} from "@/services/barbers/product-commissions";
import { auditBarbers } from "@/services/barbers/audit";
import { requireBarbersAccess } from "@/services/barbers/roles";

async function requireUserAndTenant() {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  return { userId: user.id, tenant };
}

export async function createCustomerSaleAction(input: CustomerSaleInput) {
  await requireBarbersAccess(["operate"]);
  const { userId, tenant } = await requireUserAndTenant();
  const row = await createCustomerSale(tenant.id, userId, input);
  await auditBarbers(tenant.id, userId, "productCustomerSale.created", {
    barberId: row.barberId,
    entityId: row.id,
    summary: { product: row.productName, amount: Number(row.total), commission: Number(row.commissionTotal), date: row.saleDate },
  });
  revalidatePath("/barbers/product-closing");
}

export async function deleteCustomerSaleAction(id: string) {
  await requireBarbersAccess(["operate"]);
  const { userId, tenant } = await requireUserAndTenant();
  const row = await deleteCustomerSale(tenant.id, id);
  if (row) {
    await auditBarbers(tenant.id, userId, "productCustomerSale.deleted", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { product: row.productName, amount: Number(row.total), commission: Number(row.commissionTotal), date: row.saleDate },
    });
  }
  revalidatePath("/barbers/product-closing");
}

export async function markCommissionsPaidAction(input: {
  barberId?: string;
  from?: string;
  to?: string;
  saleIds?: string[];
  paidAt: string;
  asCashOutflow: boolean;
}) {
  await requireBarbersAccess(["settle"]);
  const { userId, tenant } = await requireUserAndTenant();
  const { count, amount } = await markCommissionsPaid(tenant.id, userId, input);
  if (count > 0) {
    await auditBarbers(tenant.id, userId, "productCommission.paid", {
      barberId: input.barberId ?? null,
      summary: { count, amount, date: input.paidAt },
      reason: input.asCashOutflow ? "cash outflow" : null,
    });
  }
  revalidatePath("/barbers/product-closing");
  return { count, amount };
}

export async function unmarkCommissionPaidAction(saleId: string) {
  await requireBarbersAccess(["settle"]);
  const { userId, tenant } = await requireUserAndTenant();
  const row = await unmarkCommissionPaid(tenant.id, saleId);
  if (row) {
    await auditBarbers(tenant.id, userId, "productCommission.unpaid", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { product: row.productName, amount: Number(row.commissionTotal) },
    });
  }
  revalidatePath("/barbers/product-closing");
}
