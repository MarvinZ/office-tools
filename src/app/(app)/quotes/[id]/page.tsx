import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getQuote } from "@/services/quotes/quotes";
import { listClients } from "@/services/clients/clients";
import QuoteDetailClient from "./_components/quote-detail-client";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const [quote, clientRows, t] = await Promise.all([
    getQuote(tenant.id, id),
    listClients(tenant.id),
    getTranslations("quotes"),
  ]);

  if (!quote) notFound();

  const clients = clientRows.map((c) => ({ id: c.id, name: c.name, billingEmail: c.billingEmail }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/quotes" className="hover:text-black dark:hover:text-white">
          {t("page.title")}
        </Link>
        <span>/</span>
        <span className="font-mono text-zinc-700 dark:text-zinc-300">{quote.number}</span>
      </div>

      <QuoteDetailClient quote={quote} clients={clients} />
    </div>
  );
}
