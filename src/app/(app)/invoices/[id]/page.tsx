import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getInvoice } from "@/services/invoices/invoices";
import { listClients } from "@/services/clients/clients";
import InvoiceDetailClient from "./_components/invoice-detail-client";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const [invoice, clientRows, t] = await Promise.all([
    getInvoice(tenant.id, id),
    listClients(tenant.id),
    getTranslations("invoices"),
  ]);

  if (!invoice) notFound();

  const clients = clientRows.map((c) => ({ id: c.id, name: c.name, billingEmail: c.billingEmail }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/invoices" className="hover:text-black dark:hover:text-white">
          {t("page.title")}
        </Link>
        <span>/</span>
        <span className="font-mono text-zinc-700 dark:text-zinc-300">{invoice.number}</span>
      </div>

      <InvoiceDetailClient invoice={invoice} clients={clients} />
    </div>
  );
}
