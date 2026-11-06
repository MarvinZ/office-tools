import Link from "next/link";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getFortnightSettlements, type BarberSettlementRow, type SettlementTotals } from "@/services/barbers/settlements";
import { fortnightOf, fortnightRange, type Fortnight } from "@/lib/barbers/settlement";
import { todayBusinessDate } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";

export const dynamic = "force-dynamic";

// ?period=YYYY-MM-H, H = 1 (days 1–15) or 2 (16–end of month).
const PERIOD_RE = /^(\d{4})-(\d{2})-([12])$/;

function parsePeriod(value: string | undefined): Fortnight {
  const m = value ? PERIOD_RE.exec(value) : null;
  if (m) {
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return fortnightRange(Number(m[1]), month, Number(m[3]) as 1 | 2);
  }
  return fortnightOf(todayBusinessDate());
}

function periodParam(f: Fortnight): string {
  return `${f.year}-${String(f.month).padStart(2, "0")}-${f.half}`;
}

function shift(f: Fortnight, step: 1 | -1): Fortnight {
  if (step === 1) {
    return f.half === 1
      ? fortnightRange(f.year, f.month, 2)
      : f.month === 12 ? fortnightRange(f.year + 1, 1, 1) : fortnightRange(f.year, f.month + 1, 1);
  }
  return f.half === 2
    ? fortnightRange(f.year, f.month, 1)
    : f.month === 1 ? fortnightRange(f.year - 1, 12, 2) : fortnightRange(f.year, f.month - 1, 2);
}

/** dd/mm/aaaa, per the spec's localization requirement. */
function fmtDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers")]);
  const fortnight = parsePeriod(period);
  const { rows, totals, settings } = await getFortnightSettlements(tenant.id, fortnight);

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
        <Link href={`/barbers/settlements?period=${periodParam(shift(fortnight, -1))}`} className={navCls} aria-label={t("settlements.prev")}>
          <ChevronLeft size={16} />
        </Link>
        <div className="text-sm font-medium text-black dark:text-white">
          {t(fortnight.half === 1 ? "settlements.firstHalf" : "settlements.secondHalf")} · {fmtDay(fortnight.from)} – {fmtDay(fortnight.to)}
        </div>
        <Link href={`/barbers/settlements?period=${periodParam(shift(fortnight, 1))}`} className={navCls} aria-label={t("settlements.next")}>
          <ChevronRight size={16} />
        </Link>
      </div>

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
                      <Link href={`/barbers/barbers/${r.barberId}`} className="hover:underline">{r.barberName}</Link>
                      {r.shortfall > 0 && (
                        <span className="mt-0.5 block text-xs font-normal text-amber-600 dark:text-amber-400">
                          {t("settlements.shortfall", { amount: fmtColones(r.shortfall) })}
                        </span>
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

      <p className="text-xs text-zinc-400">{t("settlements.footnote")}</p>
    </div>
  );
}
