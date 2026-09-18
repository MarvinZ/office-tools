"use client";

import { useTranslations } from "next-intl";
import { fmtColones } from "@/lib/barbers/currency";
import type { PayoutReport } from "@/services/barbers/payout-report";

/**
 * Render the stored timestamp as a YYYY-MM-DD calendar day in UTC — the same
 * frame the report's from/to range is evaluated in (see startOfDayUtc /
 * endOfDayUtc in payout-report.ts). Formatting in local time here would let a
 * row display a day outside the range it was actually selected by.
 */
function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export default function ReportTable({ report }: { report: PayoutReport }) {
  const t = useTranslations("barbers");

  return (
    <div className="flex flex-col gap-6">
      {/* Per-barber summary */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {[t("reportsPage.colBarber"), t("reportsPage.colCount"), t("reportsPage.colTotalPrice"), t("reportsPage.colTotalCommission")].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.barberSummaries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-400">{t("reportsPage.empty")}</td>
              </tr>
            ) : report.barberSummaries.map((s) => (
              <tr key={s.barberId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium text-black dark:text-white">{s.barberName}</td>
                <td className="px-4 py-3 text-zinc-500">{s.count}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{fmtColones(s.sumPrice)}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{fmtColones(s.sumCommission)}</td>
              </tr>
            ))}
          </tbody>
          {report.barberSummaries.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50 font-semibold dark:border-zinc-800 dark:bg-zinc-900">
                <td className="px-4 py-3 text-black dark:text-white">{t("reportsPage.grandTotal")}</td>
                <td className="px-4 py-3 text-black dark:text-white">{report.grandTotal.count}</td>
                <td className="px-4 py-3 text-black dark:text-white">{fmtColones(report.grandTotal.sumPrice)}</td>
                <td className="px-4 py-3 text-black dark:text-white">{fmtColones(report.grandTotal.sumCommission)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>

      {/* Line items */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("reportsPage.lineItemsTitle")}</h2>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                {[t("reportsPage.colDate"), t("reportsPage.colBarber"), t("reportsPage.colLocation"), t("reportsPage.colService"), t("reportsPage.colPaymentMethod"), t("reportsPage.colPrice"), t("reportsPage.colCommission")].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.lineItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-400">{t("reportsPage.empty")}</td>
                </tr>
              ) : report.lineItems.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-3 text-zinc-500">{fmtDate(item.performedAt)}</td>
                  <td className="px-4 py-3 text-black dark:text-white">{item.barberName}</td>
                  <td className="px-4 py-3 text-zinc-500">{item.locationName}</td>
                  <td className="px-4 py-3 text-zinc-500">{item.serviceName}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-500">{item.paymentMethodName}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{fmtColones(item.priceCharged)}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{fmtColones(item.commissionAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
