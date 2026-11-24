"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createVoucher, deleteVoucher } from "@/services/barbers/vouchers";
import type { VoucherInput } from "@/services/barbers/vouchers";
import { auditBarbers } from "@/services/barbers/audit";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { BarbersError } from "@/lib/barbers/errors";
import { barbersAction } from "@/services/barbers/action";

export async function createVoucherAction(data: VoucherInput) {
  return barbersAction(async () => {
    await requireBarbersAccess(["operate"]);
    const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
    if (!user) throw new BarbersError("notAuthenticated");
    const row = await createVoucher(tenant.id, user.id, data);
    await auditBarbers(tenant.id, user.id, "vale.created", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { amount: Number(row.amount), date: row.issuedDate },
    });
    revalidatePath("/barbers/vales");
    return row;
  });
}

export async function deleteVoucherAction(id: string) {
  return barbersAction(async () => {
    await requireBarbersAccess(["operate"]);
    const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
    if (!user) throw new BarbersError("notAuthenticated");
    const row = await deleteVoucher(tenant.id, id);
    if (row) {
      await auditBarbers(tenant.id, user.id, "vale.deleted", {
        barberId: row.barberId,
        entityId: row.id,
        summary: { amount: Number(row.amount), date: row.issuedDate },
      });
    }
    revalidatePath("/barbers/vales");
  });
}
