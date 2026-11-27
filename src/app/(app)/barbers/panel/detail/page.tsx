import Link from "next/link";
import Decimal from "decimal.js";
import { getLocale, getTranslations } from "next-intl/server";
import { requireBarbersPage } from "@/services/barbers/roles";
import { getPanelConfig, listSalesDetail } from "@/services/barbers/panel";
import { userNames } from "@/services/barbers/audit";
import { PAGE_AREAS } from "@/lib/barbers/permissions";
import { fmtDay, isDateString, todayBusinessDate } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import { monthOf, monthRange, parseMonthKey } from "@/lib/barbers/panel";
import { fmtDateTime } from "../_lib/format";

export const dynamic = "force-dynamic";

/**
 * The movements behind any panel figure (Módulo 1 §16, CA 10). Uses the same
 * filters as the totals, so this list adds up to the figure it came from.
 */
export default async function PanelDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; month?: string; locationId?: string }>;
}) {
  const me = await requireBarbersPage(PAGE_AREAS["/barbers/panel"]);
  const [params, t, locale, config] = await Promise.all([
    searchParams,
    getTranslations("barbers.panel"),
    getLocale(),
    getPanelConfig(me.tenant.id),
  ]);

  const today = todayBusinessDate();
  const month = parseMonthKey(params.month);
  let { from, to } = month ? monthRange(month) : monthRange(monthOf(today));
  if (!month && isDateString(params.from) && isDateString(params.to) && params.from <= params.to) {
    from = params.from;
    to = params.to;
  }
  const location = config.locations.find((l) => l.id === params.locationId) ?? null;
  const locationId = location?.id ?? null;

  const rows = await listSalesDetail(me.tenant.id, { from, to, locationId });
  const names = await userNames([...new Set(rows.map((r) => r.createdBy))]);
  const total = rows.reduce((acc, r) => acc.plus(r.amount), new Decimal(0)).toNumber();
  const backHref = locationId ? `/barbers/panel?locationId=${locationId}` : "/barbers/panel";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href={backHref} className="hover:text-black dark:hover:text-white">{t("detail.back")}</Link>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("detail.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("detail.period", { from: fmtDay(from), to: fmtDay(to) })} · {location?.name ?? t("allLocations")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-zinc-500">{t("detail.total")}</p>
          <p className="text-2xl font-semibold tabular-nums text-black dark:text-white">{fmtColones(total)}</p>
          <p className="text-xs text-zinc-500">{t("detail.count", { count: rows.length })}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          {t("detail.empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  {["colDate", "colKind", "colDescription", "colBarber", "colLocation", "colMethod", "colCustomer", "colCreatedBy"].map((c) => (
                    <th key={c} className="px-4 py-3 font-semibold">{t(`detail.${c}`)}</th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold">{t("detail.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.kind}-${r.id}`} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {r.performedAt ? fmtDateTime(r.performedAt, locale) : fmtDay(r.date)}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {r.kind === "service" ? t("detail.kindService") : t("detail.kindProduct")}
                    </td>
                    <td className="px-4 py-2.5 text-black dark:text-white">{r.description}</td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{r.barberName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{r.locationName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{r.paymentMethodName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                      {r.customerName ?? <span className="italic text-zinc-400">{t("visits.noName")}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{names.get(r.createdBy) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-black dark:text-white">{fmtColones(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer className="flex flex-col gap-1 text-xs text-zinc-400">
        <p>{t("salesDefinition")}</p>
        {locationId && <p>{t("detail.productsWithoutLocation")}</p>}
      </footer>
    </div>
  );
}
