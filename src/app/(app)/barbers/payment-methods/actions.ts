"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createPaymentMethod, updatePaymentMethod } from "@/services/barbers/payment-methods";
import type { PaymentMethodInput } from "@/services/barbers/payment-methods";

export async function createPaymentMethodAction(data: PaymentMethodInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await createPaymentMethod(tenant.id, user.id, data);
  revalidatePath("/barbers/payment-methods");
}

export async function updatePaymentMethodAction(id: string, data: Partial<PaymentMethodInput>) {
  const tenant = await requireTenant();
  await updatePaymentMethod(tenant.id, id, data);
  revalidatePath("/barbers/payment-methods");
}
