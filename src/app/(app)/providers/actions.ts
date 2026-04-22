"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createProvider } from "@/services/providers/providers";
import type { ProviderInput } from "@/services/providers/providers";

export async function createProviderAction(data: ProviderInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await createProvider(tenant.id, user.id, data);
  revalidatePath("/providers");
}
