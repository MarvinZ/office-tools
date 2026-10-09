"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/services/tenants";
import { inviteClientAdmin } from "@/lib/clerk-admin";

async function requireOrgAdmin() {
  const { orgRole } = await auth();
  if (orgRole !== "org:admin") throw new Error("Not authorized.");
}

export async function inviteTeamMemberAction(email: string) {
  await requireOrgAdmin();
  const tenant = await requireTenant();

  const trimmed = email.trim();
  if (!trimmed) return { error: "Email is required." };

  try {
    await inviteClientAdmin(tenant.clerkOrgId, trimmed);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send invitation." };
  }

  revalidatePath("/team");
  return { success: true };
}
