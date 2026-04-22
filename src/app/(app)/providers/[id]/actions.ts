"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import {
  updateProvider, deleteProvider,
  addProviderContact, deleteProviderContact,
  addProviderNote, deleteProviderNote,
} from "@/services/providers/providers";
import type { ProviderInput, ContactInput } from "@/services/providers/providers";

export async function updateProviderAction(id: string, data: Partial<ProviderInput>) {
  const tenant = await requireTenant();
  await updateProvider(tenant.id, id, data);
  revalidatePath("/providers");
  revalidatePath(`/providers/${id}`);
}

export async function deleteProviderAction(id: string) {
  const tenant = await requireTenant();
  await deleteProvider(tenant.id, id);
  redirect("/providers");
}

export async function addProviderContactAction(providerId: string, data: ContactInput) {
  const tenant = await requireTenant();
  await addProviderContact(tenant.id, providerId, data);
  revalidatePath(`/providers/${providerId}`);
}

export async function deleteProviderContactAction(providerId: string, contactId: string) {
  const tenant = await requireTenant();
  await deleteProviderContact(tenant.id, contactId);
  revalidatePath(`/providers/${providerId}`);
}

export async function addProviderNoteAction(providerId: string, body: string) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await addProviderNote(tenant.id, providerId, user.id, body);
  revalidatePath(`/providers/${providerId}`);
}

export async function deleteProviderNoteAction(providerId: string, noteId: string) {
  const tenant = await requireTenant();
  await deleteProviderNote(tenant.id, noteId);
  revalidatePath(`/providers/${providerId}`);
}
