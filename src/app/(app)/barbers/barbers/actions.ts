"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createBarber, setBarberLocations } from "@/services/barbers/barbers";
import type { BarberInput } from "@/services/barbers/barbers";

export async function createBarberAction(data: BarberInput, locationIds: string[]) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const barber = await createBarber(tenant.id, user.id, data);
  if (locationIds.length > 0) {
    await setBarberLocations(tenant.id, barber.id, locationIds);
  }
  revalidatePath("/barbers/barbers");
  return barber;
}
