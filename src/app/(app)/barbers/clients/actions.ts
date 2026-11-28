"use server";

import { revalidatePath } from "next/cache";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { createClient, searchClients, updateClient } from "@/services/barbers/clients";
import { barbersAction } from "@/services/barbers/action";
import { todayBusinessDate } from "@/lib/barbers/dates";
import type { ClientInput } from "@/lib/barbers/clients";

/** Front desk: find a client by name or phone while charging. */
export async function searchClientsAction(q: string) {
  return barbersAction(async () => {
    const me = await requireBarbersAccess(["operate", "overview"]);
    return searchClients(me.tenant.id, q);
  });
}

/** Front desk (quick, while charging) or admins (client list). */
export async function createClientAction(input: ClientInput) {
  return barbersAction(async () => {
    const me = await requireBarbersAccess(["operate", "overview"]);
    const row = await createClient(me.tenant.id, me.userId, input, todayBusinessDate());
    revalidatePath("/barbers/clients");
    return { id: row.id, fullName: row.fullName, phone: row.phone };
  });
}

/** Editing records is for admins (Módulo 1 §15: client activity is admin-only). */
export async function updateClientAction(id: string, input: ClientInput) {
  return barbersAction(async () => {
    const me = await requireBarbersAccess(["overview"]);
    await updateClient(me.tenant.id, id, input, todayBusinessDate());
    revalidatePath("/barbers/clients");
    revalidatePath(`/barbers/clients/${id}`);
  });
}
