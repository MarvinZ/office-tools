"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { adminUpdateTenantStatus, adminEnableTool, adminDisableTool } from "@/services/admin/tenants";
import { seedDemoData, resetDemoData } from "@/services/admin/demo";

export async function toggleTenantStatusAction(tenantId: string, isActive: boolean) {
  await adminUpdateTenantStatus(tenantId, isActive);
  revalidatePath("/admin");
  revalidatePath(`/admin/${tenantId}`);
}

export async function toggleToolAction(tenantId: string, toolId: string, enabled: boolean) {
  if (enabled) {
    await adminEnableTool(tenantId, toolId);
  } else {
    await adminDisableTool(tenantId, toolId);
  }
  revalidatePath(`/admin/${tenantId}`);
}

export async function seedDemoAction(tenantId: string) {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  await seedDemoData(tenantId, user.id);
  revalidatePath(`/admin/${tenantId}`);
}

export async function resetDemoAction(tenantId: string) {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  await resetDemoData(tenantId);
  revalidatePath(`/admin/${tenantId}`);
}
