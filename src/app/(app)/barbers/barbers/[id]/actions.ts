"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/services/tenants";
import {
  updateBarber, setBarberLocations, setBarberServiceRate, removeBarberServiceRate,
} from "@/services/barbers/barbers";
import type { BarberInput } from "@/services/barbers/barbers";

export async function updateBarberAction(id: string, data: Partial<BarberInput>) {
  const tenant = await requireTenant();
  await updateBarber(tenant.id, id, data);
  revalidatePath("/barbers/barbers");
  revalidatePath(`/barbers/barbers/${id}`);
}

export async function setBarberLocationsAction(id: string, locationIds: string[]) {
  const tenant = await requireTenant();
  await setBarberLocations(tenant.id, id, locationIds);
  revalidatePath(`/barbers/barbers/${id}`);
}

export async function setBarberServiceRateAction(id: string, serviceId: string, commissionRate: number) {
  const tenant = await requireTenant();
  await setBarberServiceRate(tenant.id, id, serviceId, commissionRate);
  revalidatePath(`/barbers/barbers/${id}`);
}

export async function removeBarberServiceRateAction(id: string, serviceId: string) {
  const tenant = await requireTenant();
  await removeBarberServiceRate(tenant.id, id, serviceId);
  revalidatePath(`/barbers/barbers/${id}`);
}
