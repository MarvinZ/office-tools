"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createService, updateService } from "@/services/barbers/catalog";
import type { ServiceInput } from "@/services/barbers/catalog";
import { auditBarbers, diffFields } from "@/services/barbers/audit";

export async function createServiceAction(data: ServiceInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await createService(tenant.id, user.id, data);
  revalidatePath("/barbers/services");
}

export async function updateServiceAction(id: string, data: Partial<ServiceInput>) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const result = await updateService(tenant.id, id, data);
  // Only the default rate affects pay; names/categories aren't audited here.
  const changes = result ? diffFields(result.before, result.after, ["defaultCommissionRate"]) : {};
  if (result && Object.keys(changes).length > 0) {
    await auditBarbers(tenant.id, user.id, "service.rate", { entityId: id, summary: { name: result.after.name }, changes });
  }
  revalidatePath("/barbers/services");
}
