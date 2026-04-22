import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listTrades, getCoverageAreas } from "@/services/coverage/coverage";
import CoverageMapClient from "./_components/coverage-map-client";

export const dynamic = "force-dynamic";

export default async function CoverageTradeePage({ params }: { params: Promise<{ tradeId: string }> }) {
  const { tradeId } = await params;
  const tenant = await requireTenant();
  const [allTrades, areas, t] = await Promise.all([
    listTrades(),
    getCoverageAreas(tenant.id, tradeId),
    getTranslations("coverage"),
  ]);

  const trade = allTrades.find((tr) => tr.id === tradeId);
  if (!trade) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/coverage" className="hover:text-black dark:hover:text-white">{t("page.title")}</Link>
        <span>/</span>
        <span className="text-black dark:text-white">{trade.name}</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{trade.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("detail.subtitle", { count: areas.length })}</p>
      </div>

      <CoverageMapClient
        tradeId={trade.id}
        tradeName={trade.name}
        initialAreas={areas}
      />
    </div>
  );
}
