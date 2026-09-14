"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { logActivity, deleteActivity } from "@/services/barbers/activities";
import { checkInBarber, checkOutBarber } from "@/services/barbers/roster";
import type { LogActivityInput } from "@/services/barbers/activities";

export async function logActivityAction(data: LogActivityInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const row = await logActivity(tenant.id, user.id, data);
  revalidatePath("/barbers");
  return row;
}

export async function deleteActivityAction(id: string) {
  const tenant = await requireTenant();
  await deleteActivity(tenant.id, id);
  revalidatePath("/barbers");
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
