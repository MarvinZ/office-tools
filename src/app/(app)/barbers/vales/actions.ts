"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createVoucher, deleteVoucher } from "@/services/barbers/vouchers";
import type { VoucherInput } from "@/services/barbers/vouchers";

export async function createVoucherAction(data: VoucherInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const row = await createVoucher(tenant.id, user.id, data);
  revalidatePath("/barbers/vales");
  return row;
}

export async function deleteVoucherAction(id: string) {
  const tenant = await requireTenant();
  await deleteVoucher(tenant.id, id);
  revalidatePath("/barbers/vales");
}
