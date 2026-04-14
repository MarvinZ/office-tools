import { notFound } from "next/navigation";
import Link from "next/link";
import { getAsset } from "@/services/assets/assets";
import { DEV_TENANT_ID } from "@/lib/constants";
import { STATUS_CONFIG } from "../_mock/data";
import AssetTabs from "./_components/asset-tabs";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({ params }: Props) {
  const { id } = await params;
  const asset = await getAsset(DEV_TENANT_ID, id);
  if (!asset) notFound();

  const cfg = STATUS_CONFIG[asset.status];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/assets" className="hover:text-black dark:hover:text-white">Assets</Link>
        <span>›</span>
        <span className="text-black dark:text-white">{asset.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {asset.photos[0] ? (
            <img src={asset.photos[0].blobUrl} alt={asset.name} className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-2xl dark:bg-zinc-800">📦</div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white">{asset.name}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">{asset.brand} · {asset.model} · {asset.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
          <button className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400">
            Edit
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Purchase Price", value: `$${Number(asset.purchasePrice).toLocaleString()}` },
          { label: "Location", value: asset.location },
          { label: "Assigned To", value: asset.assignedTo ?? "—" },
          { label: "Warranty Until", value: new Date(asset.warrantyExpiry).toLocaleDateString("en-US", { year: "numeric", month: "short" }) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{s.label}</p>
            <p className="mt-1 text-base font-semibold text-black dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <AssetTabs asset={asset} />
    </div>
  );
}
