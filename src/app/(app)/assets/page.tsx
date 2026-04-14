import { listAssets } from "@/services/assets/assets";
import { listEmployees } from "@/services/employees/employees";
import { DEV_TENANT_ID } from "@/lib/constants";
import { ASSET_CATEGORIES } from "./_mock/data";
import AssetListClient from "./_components/asset-list-client";
import AddAssetModal from "./_components/add-asset-modal";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const [assets, employees] = await Promise.all([
    listAssets(DEV_TENANT_ID),
    listEmployees(DEV_TENANT_ID),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">Assets</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {assets.length} assets across {ASSET_CATEGORIES.length} categories
          </p>
        </div>
        <AddAssetModal employees={employees} />
      </div>

      <AssetListClient assets={assets} />
    </div>
  );
}
