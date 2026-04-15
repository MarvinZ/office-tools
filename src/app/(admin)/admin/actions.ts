"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClientOrg, inviteClientAdmin } from "@/lib/clerk-admin";
import { adminCreateTenant, adminUpdateTenantStatus, adminEnableTool, adminDisableTool } from "@/services/admin/tenants";

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function createClientAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const name = (formData.get("name") as string).trim();
  const adminEmail = (formData.get("adminEmail") as string).trim();

  if (!name || !adminEmail) return { error: "Name and admin email are required." };

  const slug = toSlug(name);

  // 1. Create Clerk org
  const org = await createClientOrg(name, userId);

  // 2. Persist tenant in DB
  const tenant = await adminCreateTenant({
    id: crypto.randomUUID(),
    clerkOrgId: org.id,
    name,
    slug: org.slug ?? slug,
  });

  // 3. Invite the client admin
  try {
    await inviteClientAdmin(org.id, adminEmail);
  } catch {
    // Don't fail the whole flow if invite fails — admin can resend manually
  }

  redirect(`/admin/${tenant.id}`);
}

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
