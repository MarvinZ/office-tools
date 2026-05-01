"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { updateInvoice, updateInvoiceStatus, deleteInvoice } from "@/services/invoices/invoices";
import type { InvoiceInput, InvoiceStatusTransition } from "@/services/invoices/invoices";

export async function updateInvoiceAction(invoiceId: string, data: InvoiceInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) return { error: "Not authenticated." };

  await updateInvoice(tenant.id, invoiceId, user.id, data);
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

export async function updateInvoiceStatusAction(invoiceId: string, status: InvoiceStatusTransition, note?: string) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) return { error: "Not authenticated." };

  await updateInvoiceStatus(tenant.id, invoiceId, user.id, status, note);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: true };
}

export async function deleteInvoiceAction(invoiceId: string) {
  const [, tenant] = await Promise.all([currentUser(), requireTenant()]);
  await deleteInvoice(tenant.id, invoiceId);
  revalidatePath("/invoices");
  return { ok: true };
}
