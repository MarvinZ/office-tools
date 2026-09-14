"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createService, updateService } from "@/services/barbers/catalog";
import type { ServiceInput } from "@/services/barbers/catalog";

export async function createServiceAction(data: ServiceInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await createService(tenant.id, user.id, data);
  revalidatePath("/barbers/services");
}

export async function updateServiceAction(id: string, data: Partial<ServiceInput>) {
  const tenant = await requireTenant();
  await updateService(tenant.id, id, data);
  revalidatePath("/barbers/services");
}
