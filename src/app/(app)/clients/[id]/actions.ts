"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import {
  updateClient, deleteClient,
  addClientContact, deleteClientContact,
  addClientNote, deleteClientNote,
} from "@/services/clients/clients";
import type { ClientInput, ContactInput } from "@/services/clients/clients";

export async function updateClientAction(id: string, data: Partial<ClientInput>) {
  const tenant = await requireTenant();
  await updateClient(tenant.id, id, data);
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

export async function deleteClientAction(id: string) {
  const tenant = await requireTenant();
  await deleteClient(tenant.id, id);
  redirect("/clients");
}

export async function addContactAction(clientId: string, data: ContactInput) {
  const tenant = await requireTenant();
  await addClientContact(tenant.id, clientId, data);
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteContactAction(clientId: string, contactId: string) {
  const tenant = await requireTenant();
  await deleteClientContact(tenant.id, contactId);
  revalidatePath(`/clients/${clientId}`);
}

export async function addNoteAction(clientId: string, body: string) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) throw new Error("Not authenticated.");
  await addClientNote(tenant.id, clientId, user.id, body);
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteNoteAction(clientId: string, noteId: string) {
  const tenant = await requireTenant();
  await deleteClientNote(tenant.id, noteId);
  revalidatePath(`/clients/${clientId}`);
}
