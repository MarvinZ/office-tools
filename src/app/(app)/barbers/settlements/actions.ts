"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { closeFortnight, createCarryOver, deleteCarryOver, reopenFortnight } from "@/services/barbers/settlements";
import { auditBarbers } from "@/services/barbers/audit";
import { parseFortnightKey } from "@/lib/barbers/settlement";

/** Closing, reopening and carry-overs change what gets paid: org admins only. */
async function requireAdmin() {
  const { userId, orgRole } = await auth();
  if (!userId) throw new Error("Not authenticated.");
  if (orgRole !== "org:admin") throw new Error("Only an admin can do this.");
  return userId;
}

function fortnightFrom(period: string) {
  const fortnight = parseFortnightKey(period);
  if (!fortnight) throw new Error("Invalid period.");
  return fortnight;
}

export async function closeFortnightAction(period: string) {
  const [userId, tenant] = await Promise.all([requireAdmin(), requireTenant()]);
  const { version, totalTransfer } = await closeFortnight(tenant.id, userId, fortnightFrom(period));
  await auditBarbers(tenant.id, userId, "fortnight.closed", { entityId: period, summary: { period, version, totalTransfer } });
  revalidatePath("/barbers/settlements");
}

export async function reopenFortnightAction(period: string, reason: string) {
  const [userId, tenant] = await Promise.all([requireAdmin(), requireTenant()]);
  const version = await reopenFortnight(tenant.id, userId, fortnightFrom(period), reason);
  await auditBarbers(tenant.id, userId, "fortnight.reopened", { entityId: period, summary: { period, version }, reason });
  revalidatePath("/barbers/settlements");
}

export async function carryOverAction(period: string, barberId: string, amount: number) {
  const [userId, tenant] = await Promise.all([requireAdmin(), requireTenant()]);
  await createCarryOver(tenant.id, userId, fortnightFrom(period), barberId, amount);
  await auditBarbers(tenant.id, userId, "carryOver.created", { barberId, entityId: period, summary: { period, amount } });
  revalidatePath("/barbers/settlements");
}

export async function undoCarryOverAction(period: string, barberId: string) {
  const [userId, tenant] = await Promise.all([requireAdmin(), requireTenant()]);
  const amount = await deleteCarryOver(tenant.id, fortnightFrom(period), barberId);
  if (amount != null) {
    await auditBarbers(tenant.id, userId, "carryOver.deleted", { barberId, entityId: period, summary: { period, amount } });
  }
  revalidatePath("/barbers/settlements");
}
