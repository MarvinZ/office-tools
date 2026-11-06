"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import {
  getBarberRow, updateBarber, setBarberLocations, setBarberServiceRate, removeBarberServiceRate,
  updateBarberSettlementProfile, updateBarberPaymentDetails,
} from "@/services/barbers/barbers";
import type { BarberInput, BarberPaymentDetailsInput, BarberSettlementProfileInput } from "@/services/barbers/barbers";
import { auditBarbers, diffFields, type BarberAuditAction } from "@/services/barbers/audit";

async function requireUserAndTenant() {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
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
  if (!before) throw new Error("Barber not found.");
  await update(tenant.id);
  const after = await getBarberRow(tenant.id, id);
  if (!after) return;
  const changes = diffFields(before as Record<string, unknown>, after as Record<string, unknown>, fields);
  if (Object.keys(changes).length > 0) {
    await auditBarbers(tenant.id, userId, action, { barberId: id, entityId: id, changes });
  }
}

export async function updateBarberAction(id: string, data: Partial<BarberInput>) {
  await auditedBarberUpdate(id, "barber.updated", ["firstName", "lastName", "phone", "email", "status"], (tenantId) =>
    updateBarber(tenantId, id, data)
  );
  revalidatePath("/barbers/barbers");
  revalidatePath(`/barbers/barbers/${id}`);
}

export async function setBarberLocationsAction(id: string, locationIds: string[]) {
  const tenant = await requireTenant();
  await setBarberLocations(tenant.id, id, locationIds);
  revalidatePath(`/barbers/barbers/${id}`);
}

export async function setBarberServiceRateAction(id: string, serviceId: string, commissionRate: number) {
  const { userId, tenant } = await requireUserAndTenant();
  const previous = await setBarberServiceRate(tenant.id, id, serviceId, commissionRate);
  if (previous !== commissionRate) {
    await auditBarbers(tenant.id, userId, "barber.rate", {
      barberId: id,
      entityId: serviceId,
      summary: { serviceId },
      changes: { commissionRate: [previous, commissionRate] },
    });
  }
  revalidatePath(`/barbers/barbers/${id}`);
}

export async function removeBarberServiceRateAction(id: string, serviceId: string) {
  const { userId, tenant } = await requireUserAndTenant();
  const previous = await removeBarberServiceRate(tenant.id, id, serviceId);
  if (previous != null) {
    await auditBarbers(tenant.id, userId, "barber.rate", {
      barberId: id,
      entityId: serviceId,
      summary: { serviceId },
      changes: { commissionRate: [previous, null] },
    });
  }
  revalidatePath(`/barbers/barbers/${id}`);
}

export async function updateBarberSettlementProfileAction(id: string, data: BarberSettlementProfileInput) {
  await auditedBarberUpdate(
    id,
    "barber.settlementProfile",
    ["appliesMaintenance", "ivaBaseRate", "ivaInformative", "fortnightlyAddition", "shortfallToSalary"],
    (tenantId) => updateBarberSettlementProfile(tenantId, id, data)
  );
  revalidatePath(`/barbers/barbers/${id}`);
  revalidatePath("/barbers/settlements");
}

export async function updateBarberPaymentDetailsAction(id: string, data: BarberPaymentDetailsInput) {
  await auditedBarberUpdate(id, "barber.paymentDetails", ["idNumber", "iban", "aliases"], (tenantId) =>
    updateBarberPaymentDetails(tenantId, id, data)
  );
  revalidatePath(`/barbers/barbers/${id}`);
}
