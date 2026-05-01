"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createInvoice } from "@/services/invoices/invoices";
import type { InvoiceInput } from "@/services/invoices/invoices";

export async function createInvoiceAction(data: InvoiceInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) return { error: "Not authenticated." };

  const invoice = await createInvoice(tenant.id, user.id, data);
  redirect(`/invoices/${invoice.id}`);
}
