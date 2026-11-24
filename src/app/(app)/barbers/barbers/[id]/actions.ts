"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import {
  getBarberRow, updateBarber, setBarberLocations,
  updateBarberSettlementProfile, updateBarberPaymentDetails,
} from "@/services/barbers/barbers";
import type { BarberInput, BarberPaymentDetailsInput, BarberSettlementProfileInput } from "@/services/barbers/barbers";
import { auditBarbers, diffFields, type BarberAuditAction } from "@/services/barbers/audit";
import { deleteFutureRateChange, recordRateChange, type RateChangeInput } from "@/services/barbers/rate-changes";
import { todayBusinessDate } from "@/lib/barbers/dates";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { BarbersError } from "@/lib/barbers/errors";
import { barbersAction } from "@/services/barbers/action";
import { unwrap } from "@/lib/barbers/errors";

async function requireUserAndTenant() {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new BarbersError("notAuthenticated");
  return { userId: user.id, tenant };
}

/**
 * Run an update of the barbers row and audit exactly which fields changed.
 * `fields` are the columns that update can touch.
 */
async function auditedBarberUpdate(
  id: string,
  action: BarberAuditAction,
  fields: string[],
  update: (tenantId: string) => Promise<unknown>
) {
  const { userId, tenant } = await requireUserAndTenant();
  const before = await getBarberRow(tenant.id, id);
  if (!before) throw new BarbersError("notFound");
  await update(tenant.id);
  const after = await getBarberRow(tenant.id, id);
  if (!after) return;
  const changes = diffFields(before as Record<string, unknown>, after as Record<string, unknown>, fields);
  if (Object.keys(changes).length > 0) {
    await auditBarbers(tenant.id, userId, action, { barberId: id, entityId: id, changes });
  }
}

export async function updateBarberAction(id: string, data: Partial<BarberInput>) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    await auditedBarberUpdate(id, "barber.updated", ["firstName", "lastName", "phone", "email", "status"], (tenantId) =>
      updateBarber(tenantId, id, data)
    );
    revalidatePath("/barbers/barbers");
    revalidatePath(`/barbers/barbers/${id}`);
  });
}

export async function setBarberLocationsAction(id: string, locationIds: string[]) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    const tenant = await requireTenant();
    await setBarberLocations(tenant.id, id, locationIds);
    revalidatePath(`/barbers/barbers/${id}`);
  });
}

/** Commission changes are always dated (spec option B); the quick editors use today. */
export async function recordRateChangeAction(input: RateChangeInput) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    const { userId, tenant } = await requireUserAndTenant();
    const { reRated, previousRate } = await recordRateChange(tenant.id, userId, input);
    await auditBarbers(tenant.id, userId, "barber.rate", {
      barberId: input.barberId,
      entityId: input.serviceId ?? input.barberId,
      summary: { serviceId: input.serviceId, from: input.effectiveFrom, reRated },
      changes: { commissionRate: [previousRate, input.rate] },
      reason: input.note ?? null,
    });
    revalidatePath(`/barbers/barbers/${input.barberId}`);
    revalidatePath("/barbers/settlements");
    revalidatePath("/barbers/reports");
    return { reRated };
  });
}

export async function deleteRateChangeAction(barberId: string, id: string) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    const { userId, tenant } = await requireUserAndTenant();
    const row = await deleteFutureRateChange(tenant.id, id);
    if (row) {
      await auditBarbers(tenant.id, userId, "barber.rate", {
        barberId,
        entityId: id,
        summary: { serviceId: row.serviceId, from: row.effectiveFrom },
        changes: { commissionRate: [row.rate != null ? Number(row.rate) : null, null] },
        reason: "scheduled change deleted",
      });
    }
    revalidatePath(`/barbers/barbers/${barberId}`);
  });
}

export async function setBarberServiceRateAction(id: string, serviceId: string, commissionRate: number) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    await unwrap(recordRateChangeAction({ barberId: id, serviceId, rate: commissionRate, effectiveFrom: todayBusinessDate() }));
  });
}

export async function removeBarberServiceRateAction(id: string, serviceId: string) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    await unwrap(recordRateChangeAction({ barberId: id, serviceId, rate: null, effectiveFrom: todayBusinessDate() }));
  });
}

export async function updateBarberSettlementProfileAction(id: string, data: BarberSettlementProfileInput) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    const { tenant } = await requireUserAndTenant();
    const before = await getBarberRow(tenant.id, id);
    if (!before) throw new BarbersError("notFound");
    const currentFixed = before.fixedCommissionRate != null ? Number(before.fixedCommissionRate) : null;
    await auditedBarberUpdate(
      id,
      "barber.settlementProfile",
      ["appliesMaintenance", "ivaBaseRate", "ivaInformative", "fortnightlyAddition", "shortfallToSalary"],
      (tenantId) => updateBarberSettlementProfile(tenantId, id, { ...data, fixedCommissionRate: currentFixed })
    );
    if (data.fixedCommissionRate !== currentFixed) {
      await unwrap(recordRateChangeAction({ barberId: id, serviceId: null, rate: data.fixedCommissionRate, effectiveFrom: todayBusinessDate() }));
    }
    revalidatePath(`/barbers/barbers/${id}`);
    revalidatePath("/barbers/settlements");
  });
}

export async function updateBarberPaymentDetailsAction(id: string, data: BarberPaymentDetailsInput) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    await auditedBarberUpdate(id, "barber.paymentDetails", ["idNumber", "iban", "aliases"], (tenantId) =>
      updateBarberPaymentDetails(tenantId, id, data)
    );
    revalidatePath(`/barbers/barbers/${id}`);
  });
}
