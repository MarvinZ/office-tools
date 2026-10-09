"use server";

import { redirect } from "next/navigation";
import { requireTenant } from "@/services/tenants";
import { deleteWebhookEvent } from "@/services/webhooks/webhooks";

export async function deleteWebhookEventDetailAction(id: string) {
  const tenant = await requireTenant();
  await deleteWebhookEvent(tenant.id, id);
  redirect("/webhooks");
}
