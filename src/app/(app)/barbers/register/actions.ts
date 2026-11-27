"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireBarbersLocation } from "@/services/barbers/roles";
import { addOutflow, closeShift, deleteOutflow, getShiftView, openShift } from "@/services/barbers/cash-register";
import { auditBarbers } from "@/services/barbers/audit";
import { barbersAction } from "@/services/barbers/action";
import { BarbersError } from "@/lib/barbers/errors";
import { requireTenant } from "@/services/tenants";

/** Everywhere the register's state or a shift's figures show up. */
function revalidateRegister() {
  revalidatePath("/barbers/register");
  revalidatePath("/barbers");
  revalidatePath("/barbers/panel");
  revalidatePath("/barbers/cash");
}

/** The shift's location decides who may act on it (front desk + location access). */
async function requireShiftAccess(shiftId: string) {
  const tenant = await requireTenant();
  const view = await getShiftView(tenant.id, shiftId);
  if (!view) throw new BarbersError("notFound");
  const me = await requireBarbersLocation(["operate"], view.shift.locationId);
  return { me, view };
}

export async function openShiftAction(locationId: string, openingCash: number) {
  return barbersAction(async () => {
    const me = await requireBarbersLocation(["operate"], locationId);
    const user = await currentUser();
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || user?.emailAddresses[0]?.emailAddress || me.userId;
    const shift = await openShift(me.tenant.id, { id: me.userId, name }, locationId, openingCash);
    await auditBarbers(me.tenant.id, me.userId, "cash.opened", {
      entityId: shift.id,
      summary: { shift: shift.shiftNumber, date: shift.businessDate, openingCash: Number(shift.openingCash) },
    });
    revalidateRegister();
    return { id: shift.id };
  });
}

export async function addOutflowAction(shiftId: string, input: { amount: number; concept: string; barberId?: string | null }) {
  return barbersAction(async () => {
    const { me } = await requireShiftAccess(shiftId);
    const row = await addOutflow(me.tenant.id, me.userId, shiftId, input);
    await auditBarbers(me.tenant.id, me.userId, "cash.outflow", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { amount: input.amount, concept: row.concept, shift: row.shift.shiftNumber, date: row.shift.businessDate },
    });
    revalidateRegister();
    if (row.barberId) revalidatePath("/barbers/vales");
  });
}

export async function deleteOutflowAction(shiftId: string, outflowId: string) {
  return barbersAction(async () => {
    const { me } = await requireShiftAccess(shiftId);
    const row = await deleteOutflow(me.tenant.id, shiftId, outflowId);
    await auditBarbers(me.tenant.id, me.userId, "cash.outflowDeleted", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { amount: Number(row.amount), concept: row.concept, shift: row.shift.shiftNumber, date: row.shift.businessDate },
    });
    revalidateRegister();
    if (row.barberId) revalidatePath("/barbers/vales");
  });
}

export async function closeShiftAction(shiftId: string, counted: Record<string, number>, note?: string) {
  return barbersAction(async () => {
    const { me } = await requireShiftAccess(shiftId);
    const { shift, closing } = await closeShift(me.tenant.id, me.userId, shiftId, counted, note);
    await auditBarbers(me.tenant.id, me.userId, "cash.closed", {
      entityId: shift.id,
      summary: {
        shift: shift.shiftNumber,
        date: shift.businessDate,
        cashier: shift.cashierName,
        expected: closing.expectedTotal,
        counted: closing.countedTotal,
        difference: closing.difference,
      },
      reason: shift.note,
    });
    revalidateRegister();
    return { id: shift.id };
  });
}
