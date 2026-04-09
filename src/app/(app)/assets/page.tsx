import Link from "next/link";
import { MOCK_ASSETS, STATUS_CONFIG, ASSET_CATEGORIES } from "./_mock/data";
import AssetListClient from "./_components/asset-list-client";

export default function AssetsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">Assets</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {MOCK_ASSETS.length} assets across {ASSET_CATEGORIES.length} categories
          </p>
        </div>
        <button className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
          + Add asset
        </button>
      </div>

      <AssetListClient assets={MOCK_ASSETS} />
    </div>
  );
}
