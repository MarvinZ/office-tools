"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { getBarberSettings, updateBarberSettings, type BarberSettings } from "@/services/barbers/settings";
import { auditBarbers, diffFields } from "@/services/barbers/audit";
import { requireBarbersAccess, setMemberRole } from "@/services/barbers/roles";
import type { BarbersRole } from "@/lib/barbers/permissions";

export async function updateBarberSettingsAction(data: BarberSettings) {
  await requireBarbersAccess(["configure"]);
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const before = await getBarberSettings(tenant.id);
  const after = await updateBarberSettings(tenant.id, user.id, data);
  const changes = diffFields(before, after, ["ivaRate", "maintenanceDailyFee", "cardFeeOnGross", "invoiceEmail"]);
  if (Object.keys(changes).length > 0) {
    await auditBarbers(tenant.id, user.id, "settings.updated", { changes });
  }
  revalidatePath("/barbers/settings");
  revalidatePath("/barbers/settlements");
}

export async function setMemberRoleAction(userId: string, role: BarbersRole) {
  const { userId: me, tenant } = await requireBarbersAccess(["configure"]);
  const { previous } = await setMemberRole(tenant, me, userId, role);
  await auditBarbers(tenant.id, me, "member.role", {
    entityId: userId,
    changes: { role: [previous, role] },
  });
  revalidatePath("/barbers/settings");
}

