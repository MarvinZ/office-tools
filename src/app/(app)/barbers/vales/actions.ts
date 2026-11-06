"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createVoucher, deleteVoucher } from "@/services/barbers/vouchers";
import type { VoucherInput } from "@/services/barbers/vouchers";
import { auditBarbers } from "@/services/barbers/audit";

export async function createVoucherAction(data: VoucherInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const row = await createVoucher(tenant.id, user.id, data);
  await auditBarbers(tenant.id, user.id, "vale.created", {
    barberId: row.barberId,
    entityId: row.id,
    summary: { amount: Number(row.amount), date: row.issuedDate },
  });
  revalidatePath("/barbers/vales");
  return row;
}

export async function deleteVoucherAction(id: string) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const row = await deleteVoucher(tenant.id, id);
  if (row) {
    await auditBarbers(tenant.id, user.id, "vale.deleted", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { amount: Number(row.amount), date: row.issuedDate },
    });
  }
  revalidatePath("/barbers/vales");
}
