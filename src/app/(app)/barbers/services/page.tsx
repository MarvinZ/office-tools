import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listServices } from "@/services/barbers/catalog";
import ServiceListClient from "./_components/service-list-client";
import CreateServiceModal from "./_components/create-service-modal";

export const dynamic = "force-dynamic";

export default async function ServicesListPage() {
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers")]);
  const services = await listServices(tenant.id);
  const active = services.filter((s) => s.status === "active").length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("servicesPage.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("servicesPage.subtitle", { total: services.length, active })}</p>
        </div>
        <CreateServiceModal />
      </div>
      <ServiceListClient services={services} />
    </div>
  );
}
