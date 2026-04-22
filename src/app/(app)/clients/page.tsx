import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listClients } from "@/services/clients/clients";
import ClientListClient from "./_components/client-list-client";
import CreateClientModal from "./_components/create-client-modal";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("clients")]);
  const clients = await listClients(tenant.id);
  const active = clients.filter((c) => c.status === "active").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("page.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.subtitle", { total: clients.length, active })}
          </p>
        </div>
        <CreateClientModal />
      </div>
      <ClientListClient clients={clients} />
    </div>
  );
}
