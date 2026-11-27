import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getCashDifferences } from "@/services/barbers/cash-shortfalls";
import { fortnightKey, fortnightOf, parseFortnightKey, shiftFortnight } from "@/lib/barbers/settlement";
import { fmtDay, todayBusinessDate } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";

export const dynamic = "force-dynamic";

/** Cashier shortfalls per fortnight, from the imported daily closings. */
export default async function CashShortfallsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers.cash")]);
  const fortnight = parseFortnightKey(period) ?? fortnightOf(todayBusinessDate());
  const report = await getCashDifferences(tenant.id, fortnight.from, fortnight.to);
  const nav =
    "inline-flex items-center rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:text-black dark:border-zinc-700 dark:hover:text-white";
  const th = "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <div className="flex items-center gap-3">
        <Link href={`/barbers/cash?period=${fortnightKey(shiftFortnight(fortnight, -1))}`} className={nav} aria-label={t("prev")}>
          <ChevronLeft size={16} />
        </Link>
        <span className="text-sm font-medium text-black dark:text-white">{fmtDay(fortnight.from)} – {fmtDay(fortnight.to)}</span>
        <Link href={`/barbers/cash?period=${fortnightKey(shiftFortnight(fortnight, 1))}`} className={nav} aria-label={t("next")}>
          <ChevronRight size={16} />
        </Link>
        <span className="ml-auto text-xs text-zinc-500">
          {t("daysImported", { count: report.daysImported })} · {t("shiftsClosed", { count: report.shiftsClosed })}
        </span>
      </div>

      {report.rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {report.daysImported === 0 && report.shiftsClosed === 0 ? t("noImports") : t("balanced")}
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className={th}>{t("cashier")}</th>
                  <th className={`${th} text-right`}>{t("shortfall")}</th>
                  <th className={`${th} text-right`}>{t("surplus")}</th>
                </tr>
              </thead>
              <tbody>
                {report.byCashier.map((c) => (
                  <tr key={c.cashier} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-4 py-2.5 font-medium text-black dark:text-white">{c.cashier}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-red-700 dark:text-red-400">
                      {c.shortfall ? fmtColones(c.shortfall) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{c.surplus ? fmtColones(c.surplus) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("applyNote", { date: fmtDay(fortnight.to) })}</p>

          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <th className={th}>{t("date")}</th>
                    <th className={th}>{t("shift")}</th>
                    <th className={th}>{t("cashier")}</th>
                    <th className={`${th} text-right`}>{t("system")}</th>
                    <th className={`${th} text-right`}>{t("counted")}</th>
                    <th className={`${th} text-right`}>{t("difference")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={`${r.date}-${r.shift}-${r.shiftId ?? "x"}`} className="border-b border-zinc-100 last:border-0 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                      <td className="whitespace-nowrap px-4 py-2.5">{fmtDay(r.date)}</td>
                      <td className="px-4 py-2.5">
                        {r.shiftId ? (
                          <Link href={`/barbers/register/${r.shiftId}`} className="underline decoration-dotted hover:text-black dark:hover:text-white">
                            {t("shiftN", { n: r.shift })}
                          </Link>
                        ) : (
                          t("shiftN", { n: r.shift })
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-black dark:text-white">{r.cashier || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{fmtColones(r.system)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{fmtColones(r.counted)}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums ${
                          r.difference > 0 ? "text-red-700 dark:text-red-400" : "text-zinc-500"
                        }`}
                      >
                        {r.difference > 0 ? t("missing", { amount: fmtColones(r.difference) }) : t("extra", { amount: fmtColones(-r.difference) })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
