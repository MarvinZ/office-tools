"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { getActivityLocationId, logActivity, logActivityBatch, logWarrantyRedo, setActivityStatus } from "@/services/barbers/activities";
import { checkInBarber, checkOutBarber } from "@/services/barbers/roster";
import { auditBarbers } from "@/services/barbers/audit";
import { businessDateOf } from "@/lib/barbers/dates";
import type { LogActivityInput, LogActivityBatchInput } from "@/services/barbers/activities";
import { requireBarbersLocation } from "@/services/barbers/roles";
import { BarbersError } from "@/lib/barbers/errors";
import { barbersAction } from "@/services/barbers/action";
import { logTicket, type TicketInput } from "@/services/barbers/tickets";

async function requireUserAndTenant() {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new BarbersError("notAuthenticated");
  return { userId: user.id, tenant };
}

async function requireActivityLocation(tenantId: string, activityId: string): Promise<string> {
  const locationId = await getActivityLocationId(tenantId, activityId);
  if (!locationId) throw new BarbersError("notFound");
  return locationId;
}

/** Everywhere a service's pay shows up. */
function revalidateActivityViews() {
  revalidatePath("/barbers");
  revalidatePath("/barbers/reports");
  revalidatePath("/barbers/settlements");
}

export async function logActivityAction(data: LogActivityInput) {
  return barbersAction(async () => {
    await requireBarbersLocation(["operate"], data.locationId);
    const { userId, tenant } = await requireUserAndTenant();
    const row = await logActivity(tenant.id, userId, data);
    await auditBarbers(tenant.id, userId, "activity.logged", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { count: 1, total: Number(row.priceCharged), date: businessDateOf(row.performedAt) },
    });
    revalidatePath("/barbers");
    return row;
  });
}

export async function logActivityBatchAction(data: LogActivityBatchInput) {
  return barbersAction(async () => {
    await requireBarbersLocation(["operate"], data.locationId);
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
  });
}

/** Services and products charged together on one ticket (written atomically). */
export async function logTicketAction(input: TicketInput) {
  return barbersAction(async () => {
    await requireBarbersLocation(["operate"], input.locationId);
    const { userId, tenant } = await requireUserAndTenant();
    const { ticketId, activities, sales } = await logTicket(tenant.id, userId, input);
    if (activities.length > 0) {
      await auditBarbers(tenant.id, userId, "activity.logged", {
        barberId: activities[0].barberId,
        entityId: ticketId,
        summary: {
          count: activities.length,
          total: activities.reduce((n, r) => n + Number(r.priceCharged), 0),
          date: businessDateOf(activities[0].performedAt),
        },
      });
    }
    for (const s of sales) {
      await auditBarbers(tenant.id, userId, "productCustomerSale.created", {
        barberId: s.barberId,
        entityId: s.id,
        summary: { product: s.productName, amount: Number(s.total), commission: Number(s.commissionTotal), date: s.saleDate },
      });
    }
    revalidatePath("/barbers");
    revalidatePath("/barbers/product-closing");
    return { activities, salesCount: sales.length };
  });
}

/** Normal ↔ courtesy, or void (reason required). Services are never deleted. */
export async function setActivityStatusAction(
  id: string,
  status: "active" | "courtesy" | "voided",
  reason?: string
) {
  return barbersAction(async () => {
    const { userId, tenant } = await requireUserAndTenant();
    // Only at a location the person may work at (Settings → people and roles).
    await requireBarbersLocation(["operate"], await requireActivityLocation(tenant.id, id));
    const { before, after } = await setActivityStatus(tenant.id, userId, id, status, reason);
    await auditBarbers(tenant.id, userId, "activity.status", {
      barberId: after.barberId,
      entityId: id,
      summary: { total: Number(after.priceCharged), date: businessDateOf(after.performedAt) },
      changes: { status: [before.status, after.status] },
      reason: after.statusReason,
    });
    revalidateActivityViews();
  });
}

export async function logWarrantyRedoAction(originalId: string, correctorBarberId: string, reason?: string) {
  return barbersAction(async () => {
    const { userId, tenant } = await requireUserAndTenant();
    await requireBarbersLocation(["operate"], await requireActivityLocation(tenant.id, originalId));
    const row = await logWarrantyRedo(tenant.id, userId, originalId, correctorBarberId, reason);
    await auditBarbers(tenant.id, userId, "activity.warranty", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { total: Number(row.priceCharged), originalActivityId: originalId },
      reason: row.statusReason,
    });
    revalidateActivityViews();
  });
}

export async function checkInBarberAction(locationId: string, barberId: string, workDate: string) {
  return barbersAction(async () => {
    await requireBarbersLocation(["operate"], locationId);
    const tenant = await requireTenant();
    await checkInBarber(tenant.id, locationId, barberId, workDate);
    revalidatePath("/barbers");
  });
}

export async function checkOutBarberAction(locationId: string, barberId: string, workDate: string) {
  return barbersAction(async () => {
    await requireBarbersLocation(["operate"], locationId);
    const tenant = await requireTenant();
    await checkOutBarber(tenant.id, locationId, barberId, workDate);
    revalidatePath("/barbers");
  });
}
