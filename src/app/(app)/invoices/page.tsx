import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listInvoices } from "@/services/invoices/invoices";
import { listClients } from "@/services/clients/clients";
import InvoiceListClient from "./_components/invoice-list-client";
import CreateInvoiceModal from "./_components/create-invoice-modal";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const tenant = await requireTenant();
  const [invoiceList, clientRows, t] = await Promise.all([
    listInvoices(tenant.id),
    listClients(tenant.id),
    getTranslations("invoices"),
  ]);

  const clients = clientRows.map((c) => ({ id: c.id, name: c.name, billingEmail: c.billingEmail }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("page.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.subtitle", { count: invoiceList.length })}
          </p>
        </div>
        <CreateInvoiceModal clients={clients} />
      </div>

      <InvoiceListClient invoices={invoiceList} />
    </div>
  );
}
