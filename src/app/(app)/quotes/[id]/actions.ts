"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { updateQuote, updateQuoteStatus, deleteQuote } from "@/services/quotes/quotes";
import type { QuoteInput, QuoteStatusTransition } from "@/services/quotes/quotes";

export async function updateQuoteAction(quoteId: string, data: QuoteInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) return { error: "Not authenticated." };

  await updateQuote(tenant.id, quoteId, user.id, data);
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

export async function updateQuoteStatusAction(quoteId: string, status: QuoteStatusTransition, note?: string) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) return { error: "Not authenticated." };

  await updateQuoteStatus(tenant.id, quoteId, user.id, status, note);
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
  return { ok: true };
}

export async function deleteQuoteAction(quoteId: string) {
  const [, tenant] = await Promise.all([currentUser(), requireTenant()]);
  await deleteQuote(tenant.id, quoteId);
  revalidatePath("/quotes");
  return { ok: true };
}
