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
import { requireBarbersAccess, requireBarbersLocation } from "@/services/barbers/roles";
import { getShiftView } from "@/services/barbers/cash-register";
import { BarbersError } from "@/lib/barbers/errors";
import { barbersAction } from "@/services/barbers/action";

async function requireUserAndTenant() {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new BarbersError("notAuthenticated");
  return { userId: user.id, tenant };
}

export async function createCustomerSaleAction(input: CustomerSaleInput) {
  return barbersAction(async () => {
    await requireBarbersLocation(["operate"], input.locationId);
    const { userId, tenant } = await requireUserAndTenant();
    const row = await createCustomerSale(tenant.id, userId, input);
    await auditBarbers(tenant.id, userId, "productCustomerSale.created", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { product: row.productName, amount: Number(row.total), commission: Number(row.commissionTotal), date: row.saleDate },
    });
    revalidatePath("/barbers/product-closing");
  });
}

export async function deleteCustomerSaleAction(id: string) {
  return barbersAction(async () => {
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
  });
}

export async function markCommissionsPaidAction(input: {
  barberId?: string;
  from?: string;
  to?: string;
  saleIds?: string[];
  paidAt: string;
  asCashOutflow: boolean;
  shiftId?: string | null;
}) {
  return barbersAction(async () => {
    await requireBarbersAccess(["settle"]);
    const { userId, tenant } = await requireUserAndTenant();
    if (input.asCashOutflow && input.shiftId) {
      // The cash comes out of that register: the person must be allowed at its location.
      const view = await getShiftView(tenant.id, input.shiftId);
      if (!view) throw new BarbersError("notFound");
      await requireBarbersLocation(["settle"], view.shift.locationId);
    }
    const { count, amount } = await markCommissionsPaid(tenant.id, userId, input);
    if (count > 0) {
      await auditBarbers(tenant.id, userId, "productCommission.paid", {
        barberId: input.barberId ?? null,
        summary: { count, amount, date: input.paidAt },
        reason: input.asCashOutflow ? "cash outflow" : null,
      });
    }
    revalidatePath("/barbers/product-closing");
    if (input.asCashOutflow) revalidatePath("/barbers/register");
    return { count, amount };
  });
}

export async function unmarkCommissionPaidAction(saleId: string) {
  return barbersAction(async () => {
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
  });
}
