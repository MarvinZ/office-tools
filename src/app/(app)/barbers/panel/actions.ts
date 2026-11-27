"use server";

import { revalidatePath } from "next/cache";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { setAlertDecision, updatePanelGoals, type GoalsInput } from "@/services/barbers/panel";
import { barbersAction } from "@/services/barbers/action";

/** Goals are set by the owner (admins: "configure"). */
export async function updatePanelGoalsAction(input: GoalsInput) {
  return barbersAction(async () => {
    const { userId, tenant } = await requireBarbersAccess(["configure"]);
    await updatePanelGoals(tenant.id, userId, input);
    revalidatePath("/barbers/panel");
  });
}

/** Records what an admin did with a recommendation; changes no business data. */
export async function decideRecommendationAction(key: string, status: "attended" | "dismissed" | null) {
  return barbersAction(async () => {
    const { userId, tenant } = await requireBarbersAccess(["overview"]);
    await setAlertDecision(tenant.id, userId, key, status);
    revalidatePath("/barbers/panel");
  });
}
