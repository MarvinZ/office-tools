"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createPaymentMethod, updatePaymentMethod } from "@/services/barbers/payment-methods";
import type { PaymentMethodInput } from "@/services/barbers/payment-methods";
import { auditBarbers, diffFields } from "@/services/barbers/audit";

export async function createPaymentMethodAction(data: PaymentMethodInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await createPaymentMethod(tenant.id, user.id, data);
  revalidatePath("/barbers/payment-methods");
}

export async function updatePaymentMethodAction(id: string, data: Partial<PaymentMethodInput>) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  const result = await updatePaymentMethod(tenant.id, id, data);
  if (result) {
    const changes = diffFields(result.before, result.after, ["name", "feeRate", "status"]);
    if (Object.keys(changes).length > 0) {
      await auditBarbers(tenant.id, user.id, "paymentMethod.updated", {
        entityId: id,
        summary: { name: result.after.name },
        changes,
      });
    }
  }
  revalidatePath("/barbers/payment-methods");
}
