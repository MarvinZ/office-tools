"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createBarber, setBarberLocations } from "@/services/barbers/barbers";
import type { BarberInput } from "@/services/barbers/barbers";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { BarbersError } from "@/lib/barbers/errors";
import { barbersAction } from "@/services/barbers/action";

export async function createBarberAction(data: BarberInput, locationIds: string[]) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
    if (!user) throw new BarbersError("notAuthenticated");
    const barber = await createBarber(tenant.id, user.id, data);
    if (locationIds.length > 0) {
      await setBarberLocations(tenant.id, barber.id, locationIds);
    }
    revalidatePath("/barbers/barbers");
    return barber;
  });
}
