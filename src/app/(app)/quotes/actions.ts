"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { createQuote } from "@/services/quotes/quotes";
import type { QuoteInput } from "@/services/quotes/quotes";

export async function createQuoteAction(data: QuoteInput) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) return { error: "Not authenticated." };

  const quote = await createQuote(tenant.id, user.id, data);
  redirect(`/quotes/${quote.id}`);
}
