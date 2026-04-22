import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listProviders } from "@/services/providers/providers";
import ProviderListClient from "./_components/provider-list-client";
import CreateProviderModal from "./_components/create-provider-modal";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("providers")]);
  const providers = await listProviders(tenant.id);
  const active = providers.filter((p) => p.status === "active").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("page.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.subtitle", { total: providers.length, active })}
          </p>
        </div>
        <CreateProviderModal />
      </div>
      <ProviderListClient providers={providers} />
    </div>
  );
}
