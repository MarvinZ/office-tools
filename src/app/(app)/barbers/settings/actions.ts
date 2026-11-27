"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { getBarberSettings, updateBarberSettings, type BarberSettings } from "@/services/barbers/settings";
import { auditBarbers, diffFields } from "@/services/barbers/audit";
import { requireBarbersAccess, setMemberLocations, setMemberRole } from "@/services/barbers/roles";
import { listLocations } from "@/services/barbers/locations";
import type { BarbersRole } from "@/lib/barbers/permissions";
import { BarbersError } from "@/lib/barbers/errors";
import { barbersAction } from "@/services/barbers/action";

export async function updateBarberSettingsAction(data: BarberSettings) {
  return barbersAction(async () => {
    await requireBarbersAccess(["configure"]);
    const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
    if (!user) throw new BarbersError("notAuthenticated");
    const before = await getBarberSettings(tenant.id);
    const after = await updateBarberSettings(tenant.id, user.id, data);
    const changes = diffFields(before, after, ["ivaRate", "maintenanceDailyFee", "cardFeeOnGross", "invoiceEmail"]);
    if (Object.keys(changes).length > 0) {
      await auditBarbers(tenant.id, user.id, "settings.updated", { changes });
    }
    revalidatePath("/barbers/settings");
    revalidatePath("/barbers/settlements");
  });
}

export async function setMemberRoleAction(userId: string, role: BarbersRole) {
  return barbersAction(async () => {
    const { userId: me, tenant } = await requireBarbersAccess(["configure"]);
    const { previous } = await setMemberRole(tenant, me, userId, role);
    await auditBarbers(tenant.id, me, "member.role", {
      entityId: userId,
      changes: { role: [previous, role] },
    });
    revalidatePath("/barbers/settings");
  });
}

/** Where someone may work; empty = every location. */
export async function setMemberLocationsAction(userId: string, locationIds: string[]) {
  return barbersAction(async () => {
    const { userId: me, tenant } = await requireBarbersAccess(["configure"]);
    const { previous } = await setMemberLocations(tenant, me, userId, locationIds);
    const names = new Map((await listLocations(tenant.id)).map((l) => [l.id, l.name]));
    const label = (ids: string[]) => (ids.length ? ids.map((id) => names.get(id) ?? id).join(", ") : null);
    await auditBarbers(tenant.id, me, "member.locations", {
      entityId: userId,
      changes: { locations: [label(previous), label(locationIds)] },
    });
    revalidatePath("/barbers/settings");
  });
}
