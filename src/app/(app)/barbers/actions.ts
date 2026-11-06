"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { logActivity, logActivityBatch, logWarrantyRedo, setActivityStatus } from "@/services/barbers/activities";
import { checkInBarber, checkOutBarber } from "@/services/barbers/roster";
import { auditBarbers } from "@/services/barbers/audit";
import { businessDateOf } from "@/lib/barbers/dates";
import type { LogActivityInput, LogActivityBatchInput } from "@/services/barbers/activities";

async function requireUserAndTenant() {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  return { userId: user.id, tenant };
}

/** Everywhere a service's pay shows up. */
function revalidateActivityViews() {
  revalidatePath("/barbers");
  revalidatePath("/barbers/reports");
  revalidatePath("/barbers/settlements");
}

export async function logActivityAction(data: LogActivityInput) {
  const { userId, tenant } = await requireUserAndTenant();
  const row = await logActivity(tenant.id, userId, data);
  await auditBarbers(tenant.id, userId, "activity.logged", {
    barberId: row.barberId,
    entityId: row.id,
    summary: { count: 1, total: Number(row.priceCharged), date: businessDateOf(row.performedAt) },
  });
  revalidatePath("/barbers");
  return row;
}

export async function logActivityBatchAction(data: LogActivityBatchInput) {
  const { userId, tenant } = await requireUserAndTenant();
  const rows = await logActivityBatch(tenant.id, userId, data);
  if (rows.length > 0) {
    await auditBarbers(tenant.id, userId, "activity.logged", {
      barberId: rows[0].barberId,
      entityId: rows[0].id,
      summary: {
        count: rows.length,
        total: rows.reduce((n, r) => n + Number(r.priceCharged), 0),
        date: businessDateOf(rows[0].performedAt),
      },
    });
  }
  revalidatePath("/barbers");
  return rows;
}

/** Normal ↔ courtesy, or void (reason required). Services are never deleted. */
export async function setActivityStatusAction(
  id: string,
  status: "active" | "courtesy" | "voided",
  reason?: string
) {
  const { userId, tenant } = await requireUserAndTenant();
  const { before, after } = await setActivityStatus(tenant.id, userId, id, status, reason);
  await auditBarbers(tenant.id, userId, "activity.status", {
    barberId: after.barberId,
    entityId: id,
    summary: { total: Number(after.priceCharged), date: businessDateOf(after.performedAt) },
    changes: { status: [before.status, after.status] },
    reason: after.statusReason,
  });
  revalidateActivityViews();
}

export async function logWarrantyRedoAction(originalId: string, correctorBarberId: string, reason?: string) {
  const { userId, tenant } = await requireUserAndTenant();
  const row = await logWarrantyRedo(tenant.id, userId, originalId, correctorBarberId, reason);
  await auditBarbers(tenant.id, userId, "activity.warranty", {
    barberId: row.barberId,
    entityId: row.id,
    summary: { total: Number(row.priceCharged), originalActivityId: originalId },
    reason: row.statusReason,
  });
  revalidateActivityViews();
}

export async function checkInBarberAction(locationId: string, barberId: string, workDate: string) {
  const tenant = await requireTenant();
  await checkInBarber(tenant.id, locationId, barberId, workDate);
  revalidatePath("/barbers");
}

export async function checkOutBarberAction(locationId: string, barberId: string, workDate: string) {
  const tenant = await requireTenant();
  await checkOutBarber(tenant.id, locationId, barberId, workDate);
  revalidatePath("/barbers");
}
