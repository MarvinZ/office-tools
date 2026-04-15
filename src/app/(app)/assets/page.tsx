import { getTranslations } from "next-intl/server";
import { listAssets } from "@/services/assets/assets";
import { listEmployees } from "@/services/employees/employees";
import { requireTenant } from "@/services/tenants";
import { ASSET_CATEGORIES } from "./_mock/data";
import AssetListClient from "./_components/asset-list-client";
import AddAssetModal from "./_components/add-asset-modal";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const tenant = await requireTenant();
  const [assets, employees, t] = await Promise.all([
    listAssets(tenant.id),
    listEmployees(tenant.id),
    getTranslations("assets"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("page.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.subtitle", { count: assets.length, categories: ASSET_CATEGORIES.length })}
          </p>
        </div>
        <AddAssetModal employees={employees} />
      </div>

      <AssetListClient assets={assets} />
    </div>
  );
}
