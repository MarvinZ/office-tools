"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { updateBarberSettings, type BarberSettings } from "@/services/barbers/settings";

export async function updateBarberSettingsAction(data: BarberSettings) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await updateBarberSettings(tenant.id, user.id, data);
  revalidatePath("/barbers/settings");
  revalidatePath("/barbers/settlements");
}
