import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { AlertTriangle, ChevronLeft, ChevronRight, FileSpreadsheet, History, Lock, Printer, Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getSettlementView, type BarberSettlementRow, type SettlementTotals } from "@/services/barbers/settlements";
import { fortnightKey, fortnightOf, parseFortnightKey, shiftFortnight } from "@/lib/barbers/settlement";
import { businessDateOf, fmtDay, todayBusinessDate } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import ClosingControls from "./_components/closing-controls";
import CarryOverControl from "./_components/carry-over-control";
import { closingStatus, parseVersion } from "./_lib/closing-status";

export const dynamic = "force-dynamic";

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; version?: string }>;
}) {
  const { period, version } = await searchParams;
  const [tenant, t, { orgRole }] = await Promise.all([requireTenant(), getTranslations("barbers"), auth()]);
  // ?period=YYYY-MM-H, H = 1 (days 1–15) or 2 (16–end of month).
  const fortnight = parseFortnightKey(period) ?? fortnightOf(todayBusinessDate());
  const key = fortnightKey(fortnight);
  const { effective, closing, isClosed, changedSinceClose, versions, carriedOut, nextClosed } = await getSettlementView(
    tenant.id,
    fortnight,
    parseVersion(version)
  );
  const { rows, totals, settings } = effective;
  // Viewing an older, superseded closing rather than the fortnight's current state.
  const viewingOld = !!closing?.reopenedAt;
  // Print/export show exactly what's on screen.
  const docQuery = viewingOld ? `period=${key}&version=${closing!.version}` : `period=${key}`;
  const isAdmin = orgRole === "org:admin";
  // "Mixtos" (spec §10.3): barbers whose services were paid at more than one rate.
  const mixed = rows.filter((r) => r.byRate.length > 1);
  const canClose = fortnight.from <= todayBusinessDate();

  const btnCls =
    "inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white";
  const navCls =
    "inline-flex items-center rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:text-black dark:border-zinc-700 dark:hover:text-white";

  // Column order follows the spec's individual settlement (§10.1).
  const columns: { key: keyof SettlementTotals | "daysWorked"; label: string; deduction?: boolean; strong?: boolean }[] = [
    { key: "serviceCount", label: t("settlements.colServices") },
    { key: "daysWorked", label: t("settlements.colDays") },
    { key: "serviceIncome", label: t("settlements.colIncome") },
    { key: "addition", label: t("settlements.colAddition") },
    { key: "cardFee", label: t("settlements.colCardFee"), deduction: true },
    { key: "maintenance", label: t("settlements.colMaintenance"), deduction: true },
    { key: "productCredit", label: t("settlements.colProductCredit"), deduction: true },
    { key: "vales", label: t("settlements.colVales"), deduction: true },
    // Only when someone actually carries a balance in — keeps the table narrow.
    ...(totals.carryOver > 0 ? [{ key: "carryOver" as const, label: t("settlements.colCarryOver"), deduction: true }] : []),
    ...(totals.warrantyClawback > 0
      ? [{ key: "warrantyClawback" as const, label: t("settlements.colWarrantyClawback"), deduction: true }]
      : []),
    { key: "net", label: t("settlements.colNet") },
    { key: "iva", label: t("settlements.colIva") },
    { key: "invoice", label: t("settlements.colInvoice") },
    { key: "tips", label: t("settlements.colTips") },
    { key: "transfer", label: t("settlements.colTransfer"), strong: true },
  ];

  function cell(row: BarberSettlementRow | SettlementTotals, key: (typeof columns)[number]["key"], isTotal: boolean) {
    if (key === "serviceCount") return row.serviceCount;
    if (key === "daysWorked") return isTotal ? "" : (row as BarberSettlementRow).daysWorked;
    const value = (row as Record<string, number>)[key];
    if (key === "iva" && !isTotal && (row as BarberSettlementRow).ivaInformative) {
      return (
        <span title={t("settlements.ivaInformativeHint")}>
          {fmtColones(value)} <span className="text-xs text-zinc-400">{t("settlements.ivaInformativeTag")}</span>
        </span>
      );
    }
    return fmtColones(value);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("settlements.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("settlements.subtitle")}</p>
        </div>
        <Link
          href="/barbers/settings"
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
        >
          <Settings size={14} />
          {t("settlements.settingsLink", {
            iva: Math.round(settings.ivaRate * 10000) / 100,
            fee: fmtColones(settings.maintenanceDailyFee),
          })}
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Link href={`/barbers/settlements?period=${fortnightKey(shiftFortnight(fortnight, -1))}`} className={navCls} aria-label={t("settlements.prev")}>
          <ChevronLeft size={16} />
        </Link>
        <div className="text-sm font-medium text-black dark:text-white">
          {t(fortnight.half === 1 ? "settlements.firstHalf" : "settlements.secondHalf")} · {fmtDay(fortnight.from)} – {fmtDay(fortnight.to)}
        </div>
        <Link href={`/barbers/settlements?period=${fortnightKey(shiftFortnight(fortnight, 1))}`} className={navCls} aria-label={t("settlements.next")}>
          <ChevronRight size={16} />
        </Link>
        {viewingOld ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <History size={12} />
            {closingStatus(t, closing)}
          </span>
        ) : closing ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
            <Lock size={12} />
            {closingStatus(t, closing)}
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {t("settlements.preliminary")}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {rows.length > 0 && (
            <>
              <a href={`/barbers/settlements/export?${docQuery}`} className={btnCls}>
                <FileSpreadsheet size={14} />
                {t("settlements.exportExcel")}
              </a>
              <Link href={`/barbers/settlements/print?${docQuery}`} target="_blank" className={btnCls}>
                <Printer size={14} />
                {t("settlements.printAll")}
              </Link>
            </>
          )}
          {viewingOld ? (
            <Link href={`/barbers/settlements?period=${key}`} className={btnCls}>
              {t("settlements.backToCurrent")}
            </Link>
          ) : (
            isAdmin && (isClosed || canClose) && <ClosingControls period={key} closed={isClosed} />
          )}
        </div>
      </div>

      {changedSinceClose && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {t("settlements.changedSinceClose")}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="sticky left-0 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                  {t("settlements.colBarber")}
                </th>
                {columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {c.deduction ? `− ${c.label}` : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-sm text-zinc-400">
                    {t("settlements.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.barberId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="sticky left-0 whitespace-nowrap bg-white px-4 py-3 font-medium text-black dark:bg-black dark:text-white">
                      <span className="inline-flex items-center gap-2">
                        <Link href={`/barbers/barbers/${r.barberId}`} className="hover:underline">{r.barberName}</Link>
                        <Link
                          href={`/barbers/settlements/print?${docQuery}&barber=${r.barberId}`}
                          target="_blank"
                          aria-label={t("settlements.printOne", { name: r.barberName })}
                          title={t("settlements.printOne", { name: r.barberName })}
                          className="text-zinc-400 hover:text-black dark:hover:text-white"
                        >
                          <Printer size={13} />
                        </Link>
                      </span>
                      {r.shortfall > 0 && (
                        <span className="mt-0.5 block text-xs font-normal text-amber-600 dark:text-amber-400">
                          {t(r.shortfallToSalary ? "settlements.shortfallToSalary" : "settlements.shortfall", {
                            amount: fmtColones(r.shortfall),
                          })}
                        </span>
                      )}
                      {r.shortfall > 0 && !r.shortfallToSalary && isAdmin && isClosed && !viewingOld && (
                        <CarryOverControl
                          period={key}
                          barberId={r.barberId}
                          shortfall={r.shortfall}
                          carried={carriedOut[r.barberId]}
                          nextClosed={nextClosed}
                        />
                      )}
                    </td>
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`whitespace-nowrap px-4 py-3 text-right ${
                          c.strong ? "font-semibold text-black dark:text-white" : "text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        {cell(r, c.key, false)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50 font-semibold dark:border-zinc-800 dark:bg-zinc-900">
                  <td className="sticky left-0 bg-zinc-50 px-4 py-3 text-black dark:bg-zinc-900 dark:text-white">{t("settlements.total")}</td>
                  {columns.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-4 py-3 text-right text-black dark:text-white">
                      {cell(totals, c.key, true)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-400">
        {t("settlements.footnote")} {t(closing ? "settlements.footnoteClosed" : "settlements.footnoteLive")}
        {totals.carryOver > 0 && ` ${t("settlements.footnoteCarryOver")}`}
        {totals.warrantyClawback > 0 && ` ${t("settlements.footnoteWarranty")}`}
      </p>

      {mixed.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-black dark:text-white">{t("settlements.mixedTitle")}</h2>
          <p className="text-xs text-zinc-500">{t("settlements.mixedSubtitle")}</p>
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                    <th className="px-4 py-2.5 text-left">{t("settlements.colBarber")}</th>
                    <th className="px-4 py-2.5 text-right">{t("settlements.colRate")}</th>
                    <th className="px-4 py-2.5 text-right">{t("settlements.colServices")}</th>
                    <th className="px-4 py-2.5 text-right">{t("settlements.colCharged")}</th>
                    <th className="px-4 py-2.5 text-right">{t("settlements.colIncome")}</th>
                  </tr>
                </thead>
                <tbody>
                  {mixed.map((r) =>
                    r.byRate.map((b, i) => (
                      <tr
                        key={`${r.barberId}-${b.rate}`}
                        className={`${i === 0 ? "border-t border-zinc-200 dark:border-zinc-800" : ""} text-zinc-600 dark:text-zinc-300`}
                      >
                        <td className="px-4 py-2 font-medium text-black dark:text-white">{i === 0 ? r.barberName : ""}</td>
                        <td className="px-4 py-2 text-right">{Math.round(b.rate * 10000) / 100}%</td>
                        <td className="px-4 py-2 text-right">{b.count}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">{fmtColones(b.grossCharged)}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">{fmtColones(b.income)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {versions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-black dark:text-white">
            <History size={14} />
            {t("settlements.historyTitle")}
          </h2>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {versions.map((v) => {
              const active = closing?.version === v.version;
              return (
                <li key={v.version} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                  <span className="font-medium text-black dark:text-white">v{v.version}</span>
                  <span className="text-zinc-500">
                    {t("settlements.historyClosed", { date: fmtDay(businessDateOf(v.closedAt)) })}
                    {v.reopenedAt
                      ? ` · ${t("settlements.historyReopened", { date: fmtDay(businessDateOf(v.reopenedAt)) })}${
                          v.reopenReason ? ` — “${v.reopenReason}”` : ""
                        }`
                      : ` · ${t("settlements.historyCurrent")}`}
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-300">
                    {t("settlements.historyTransfer", { amount: fmtColones(v.totalTransfer) })}
                  </span>
                  <span className="ml-auto">
                    {active ? (
                      <span className="text-xs text-zinc-400">{t("settlements.historyShowing")}</span>
                    ) : (
                      <Link
                        href={v.reopenedAt ? `/barbers/settlements?period=${key}&version=${v.version}` : `/barbers/settlements?period=${key}`}
                        className="text-xs text-zinc-500 underline hover:text-black dark:hover:text-white"
                      >
                        {t("settlements.historyView")}
                      </Link>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
