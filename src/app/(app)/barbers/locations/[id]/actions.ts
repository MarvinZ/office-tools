"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/services/tenants";
import { updateLocation, setLocationServicePrice } from "@/services/barbers/locations";
import type { LocationInput } from "@/services/barbers/locations";
import { barbersAction } from "@/services/barbers/action";
import { requireBarbersAccess } from "@/services/barbers/roles";

export async function updateLocationAction(id: string, data: Partial<LocationInput>) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    const tenant = await requireTenant();
    await updateLocation(tenant.id, id, data);
    revalidatePath("/barbers/locations");
    revalidatePath(`/barbers/locations/${id}`);
  });
}

export async function setLocationServicePriceAction(id: string, serviceId: string, price: number) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    const tenant = await requireTenant();
    await setLocationServicePrice(tenant.id, id, serviceId, price);
    revalidatePath(`/barbers/locations/${id}`);
  });
}
