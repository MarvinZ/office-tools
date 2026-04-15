"use server";

import { revalidatePath } from "next/cache";
import { adminUpdateTenantStatus, adminEnableTool, adminDisableTool } from "@/services/admin/tenants";

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
