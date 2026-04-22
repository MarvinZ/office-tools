"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createCoverageArea, updateCoverageArea, deleteCoverageArea } from "@/services/coverage/coverage";
import type { Polygon } from "geojson";

export async function createCoverageAreaAction(tradeId: string, polygon: Polygon, label?: string) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await createCoverageArea(tenant.id, user.id, { tradeId, polygon, label });
  revalidatePath(`/coverage/${tradeId}`);
}

export async function updateCoverageAreaAction(tradeId: string, id: string, label: string | null) {
  const tenant = await requireTenant();
  await updateCoverageArea(tenant.id, id, { label });
  revalidatePath(`/coverage/${tradeId}`);
}

export async function deleteCoverageAreaAction(tradeId: string, id: string) {
  const tenant = await requireTenant();
  await deleteCoverageArea(tenant.id, id);
  revalidatePath(`/coverage/${tradeId}`);
}
