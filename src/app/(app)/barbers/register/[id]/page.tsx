import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { canUseLocation, requireBarbersPage } from "@/services/barbers/roles";
import { getShiftView } from "@/services/barbers/cash-register";
import { userNames } from "@/services/barbers/audit";
import { PAGE_AREAS } from "@/lib/barbers/permissions";
import { fmtDay } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import { methodKey } from "@/lib/barbers/cash-register";
import PrintButton from "../../settlements/_components/print-button";
import { fmtDateTime } from "../../panel/_lib/format";

export const dynamic = "force-dynamic";

/** One shift's closing, print-formatted ("Save as PDF" is the download, like settlements). */
export default async function ShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireBarbersPage(PAGE_AREAS["/barbers/register"]);
  const { id } = await params;
  const [view, t, locale] = await Promise.all([getShiftView(me.tenant.id, id), getTranslations("barbers.register"), getLocale()]);
  if (!view || !canUseLocation(me, view.shift.locationId)) notFound();
  const { shift, closing } = view;
  const closedByName = shift.closedBy ? (await userNames([shift.closedBy])).get(shift.closedBy) ?? null : null;
  const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
  const diff = (d: number | null) =>
    d == null ? "—" : d > 0 ? t("missing", { amount: fmtColones(d) }) : d < 0 ? t("extra", { amount: fmtColones(-d) }) : t("balanced");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 print:max-w-none print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/barbers/register?locationId=${shift.locationId}`} className="text-sm text-zinc-500 hover:text-black dark:hover:text-white">
          {t("back")}
        </Link>
        <PrintButton />
      </div>

      <header>
        <p className="text-sm text-zinc-500">NOURA · {shift.locationName}</p>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("shiftTitle", { n: shift.shiftNumber, date: fmtDay(shift.businessDate) })}</h1>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
          <div>{t("cashier")}: <span className="font-medium text-black dark:text-white">{shift.cashierName}</span></div>
          <div>{t("openedAt")}: {fmtDateTime(shift.openedAt, locale)}</div>
          <div>{t("status")}: {shift.status === "closed" ? t("state.done") : t(`state.${view.state === "done" ? "open" : view.state}`)}</div>
          {shift.closedAt && <div>{t("closedAt")}: {fmtDateTime(shift.closedAt, locale)}{closedByName ? ` · ${closedByName}` : ""}</div>}
        </dl>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th className={th}>{t("method")}</th>
            <th className={`${th} text-right`}>{t("sales")}</th>
            <th className={`${th} text-right`}>{t("expected")}</th>
            <th className={`${th} text-right`}>{t("counted")}</th>
            <th className={`${th} text-right`}>{t("difference")}</th>
          </tr>
        </thead>
        <tbody>
          {closing.lines.map((l) => (
            <tr key={methodKey(l.paymentMethodId)} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="px-3 py-2">{l.name}{!l.counts && <span className="ml-2 text-xs text-zinc-400">{t("notCounted")}</span>}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtColones(l.sales)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{l.counts ? fmtColones(l.expected) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{l.counted == null || shift.status !== "closed" ? "—" : fmtColones(l.counted)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{shift.status === "closed" ? diff(l.difference) : "—"}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="px-3 py-2">{t("total")}</td>
            <td />
            <td className="px-3 py-2 text-right tabular-nums">{fmtColones(closing.expectedTotal)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{shift.status === "closed" ? fmtColones(closing.countedTotal) : "—"}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${shift.status === "closed" && closing.difference > 0 ? "text-red-700 dark:text-red-400" : ""}`}>
              {shift.status === "closed" ? diff(closing.difference) : "—"}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-zinc-500">{t("cashFormula", { opening: fmtColones(closing.openingCash), outflows: fmtColones(closing.outflows) })}</p>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-black dark:text-white">{t("outflowsTitle")}</h2>
        {view.outflows.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("noOutflows")}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {view.outflows.map((o) => (
              <li key={o.id} className="flex justify-between py-1.5">
                <span>
                  {o.kind === "commission" ? t("commissionOutflow") : o.concept}
                  {o.barberName && (
                    <span className="ml-2 text-xs text-zinc-500">{o.kind === "commission" ? o.barberName : t("valeFor", { name: o.barberName })}</span>
                  )}
                </span>
                <span className="tabular-nums">{fmtColones(o.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {shift.note && <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("note")}: {shift.note}</p>}

      <div className="mt-10 hidden grid-cols-2 gap-10 text-center text-xs text-zinc-600 print:grid">
        <div className="border-t border-zinc-400 pt-1">{t("signCashier")}</div>
        <div className="border-t border-zinc-400 pt-1">{t("signReviewer")}</div>
      </div>
    </div>
  );
}
