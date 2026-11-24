"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createTip, deleteTip } from "@/services/barbers/tips";
import type { TipInput } from "@/services/barbers/tips";
import { auditBarbers } from "@/services/barbers/audit";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { BarbersError } from "@/lib/barbers/errors";
import { barbersAction } from "@/services/barbers/action";

export async function createTipAction(data: TipInput) {
  return barbersAction(async () => {
    await requireBarbersAccess(["operate"]);
    const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
    if (!user) throw new BarbersError("notAuthenticated");
    const row = await createTip(tenant.id, user.id, data);
    await auditBarbers(tenant.id, user.id, "tip.created", {
      barberId: row.barberId,
      entityId: row.id,
      summary: { amount: Number(row.amount), date: row.tipDate },
    });
    revalidatePath("/barbers/tips");
    return row;
  });
}

export async function deleteTipAction(id: string) {
  return barbersAction(async () => {
    await requireBarbersAccess(["operate"]);
    const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
    if (!user) throw new BarbersError("notAuthenticated");
    const row = await deleteTip(tenant.id, id);
    if (row) {
      await auditBarbers(tenant.id, user.id, "tip.deleted", {
        barberId: row.barberId,
        entityId: row.id,
        summary: { amount: Number(row.amount), date: row.tipDate },
      });
    }
    revalidatePath("/barbers/tips");
  });
}
