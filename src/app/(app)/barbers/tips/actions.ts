"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createTip, deleteTip } from "@/services/barbers/tips";
import type { TipInput } from "@/services/barbers/tips";

export async function createTipAction(data: TipInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const row = await createTip(tenant.id, user.id, data);
  revalidatePath("/barbers/tips");
  return row;
}

export async function deleteTipAction(id: string) {
  const tenant = await requireTenant();
  await deleteTip(tenant.id, id);
  revalidatePath("/barbers/tips");
}
