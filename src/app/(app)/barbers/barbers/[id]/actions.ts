"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/services/tenants";
import {
  updateBarber, setBarberLocations, setBarberServiceRate, removeBarberServiceRate,
  updateBarberSettlementProfile, updateBarberPaymentDetails,
} from "@/services/barbers/barbers";
import type { BarberInput, BarberPaymentDetailsInput, BarberSettlementProfileInput } from "@/services/barbers/barbers";

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

export async function updateBarberSettlementProfileAction(id: string, data: BarberSettlementProfileInput) {
  const tenant = await requireTenant();
  await updateBarberSettlementProfile(tenant.id, id, data);
  revalidatePath(`/barbers/barbers/${id}`);
  revalidatePath("/barbers/settlements");
}

export async function updateBarberPaymentDetailsAction(id: string, data: BarberPaymentDetailsInput) {
  const tenant = await requireTenant();
  await updateBarberPaymentDetails(tenant.id, id, data);
  revalidatePath(`/barbers/barbers/${id}`);
}
