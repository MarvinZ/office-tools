"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/services/tenants";
import {
  createWebhookEndpoint,
  renameWebhookEndpoint,
  regenerateWebhookSecret,
  setWebhookEndpointActive,
  deleteWebhookEvent,
  clearWebhookEvents,
} from "@/services/webhooks/webhooks";

export async function createWebhookEndpointAction(name: string) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");

  await createWebhookEndpoint(tenant.id, user.id, name);
  revalidatePath("/webhooks");
}

export async function renameWebhookEndpointAction(id: string, name: string) {
  const tenant = await requireTenant();
  await renameWebhookEndpoint(tenant.id, id, name);
  revalidatePath("/webhooks");
}

export async function regenerateWebhookSecretAction(id: string) {
  const tenant = await requireTenant();
  await regenerateWebhookSecret(tenant.id, id);
  revalidatePath("/webhooks");
}

export async function setWebhookEndpointActiveAction(id: string, isActive: boolean) {
  const tenant = await requireTenant();
  await setWebhookEndpointActive(tenant.id, id, isActive);
  revalidatePath("/webhooks");
}

export async function deleteWebhookEventAction(id: string) {
  const tenant = await requireTenant();
  await deleteWebhookEvent(tenant.id, id);
  revalidatePath("/webhooks");
}

export async function clearWebhookEventsAction() {
  const tenant = await requireTenant();
  await clearWebhookEvents(tenant.id);
  revalidatePath("/webhooks");
}
