"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { closeFortnight, reopenFortnight } from "@/services/barbers/settlements";
import { parseFortnightKey } from "@/lib/barbers/settlement";

/** Closing and reopening lock/unlock what gets paid, so org admins only. */
async function requireAdmin() {
  const { userId, orgRole } = await auth();
  if (!userId) throw new Error("Not authenticated.");
  if (orgRole !== "org:admin") throw new Error("Only an admin can close or reopen a fortnight.");
  return userId;
}

function fortnightFrom(period: string) {
  const fortnight = parseFortnightKey(period);
  if (!fortnight) throw new Error("Invalid period.");
  return fortnight;
}

export async function closeFortnightAction(period: string) {
  const [userId, tenant] = await Promise.all([requireAdmin(), requireTenant()]);
  await closeFortnight(tenant.id, userId, fortnightFrom(period));
  revalidatePath("/barbers/settlements");
}

export async function reopenFortnightAction(period: string) {
  const [, tenant] = await Promise.all([requireAdmin(), requireTenant()]);
  await reopenFortnight(tenant.id, fortnightFrom(period));
  revalidatePath("/barbers/settlements");
}
