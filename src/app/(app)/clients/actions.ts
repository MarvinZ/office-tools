"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createClient } from "@/services/clients/clients";
import type { ClientInput } from "@/services/clients/clients";

export async function createClientAction(data: ClientInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await createClient(tenant.id, user.id, data);
  revalidatePath("/clients");
}
