"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createLocation } from "@/services/barbers/locations";
import type { LocationInput } from "@/services/barbers/locations";
import { requireBarbersAccess } from "@/services/barbers/roles";

export async function createLocationAction(data: LocationInput) {
  await requireBarbersAccess(["configure"]);
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const location = await createLocation(tenant.id, user.id, data);
  revalidatePath("/barbers/locations");
  return location;
}
