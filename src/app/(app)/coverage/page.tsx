import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listTradesWithCoverage } from "@/services/coverage/coverage";
import AddTradeButton from "./_components/add-trade-button";

export const dynamic = "force-dynamic";

function groupByCategory<T extends { category: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category)!.push(item);
  }
  return Array.from(map.entries());
}

export default async function CoveragePage() {
  const tenant = await requireTenant();
  const [trades, t] = await Promise.all([
    listTradesWithCoverage(tenant.id),
    getTranslations("coverage"),
  ]);

  const active = trades.filter((tr) => tr.areaCount > 0);
  const available = trades.filter((tr) => tr.areaCount === 0);
  const grouped = groupByCategory(active);
  const totalAreas = active.reduce((s, tr) => s + tr.areaCount, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("page.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("page.subtitle", { count: totalAreas })}</p>
        </div>
        <AddTradeButton trades={available} />
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-500">{t("page.empty")}</p>
          <p className="text-xs text-zinc-400">{t("page.emptyHint")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([category, categoryTrades]) => (
            <section key={category} className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{category}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoryTrades.map((trade) => (
                  <Link
                    key={trade.id}
                    href={`/coverage/${trade.id}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-all hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                  >
                    <span className="text-sm font-medium text-black dark:text-white">{trade.name}</span>
                    <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {t("page.areasCount", { count: trade.areaCount })}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
