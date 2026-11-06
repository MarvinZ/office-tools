import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getSettlementDocuments } from "@/services/barbers/settlements";
import { fortnightOf, parseFortnightKey } from "@/lib/barbers/settlement";
import { settlementDocLines } from "@/lib/barbers/settlement-document";
import { businessDateOf, fmtDay, todayBusinessDate } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import PrintButton from "../_components/print-button";

export const dynamic = "force-dynamic";

/**
 * Printable individual settlements (spec §10.1): one page per barber, or just
 * one barber with ?barber=. "Save as PDF" from the browser's print dialog is
 * the PDF export — no PDF library, no server-side fonts to manage.
 */
export default async function SettlementPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; barber?: string }>;
}) {
  const { period, barber } = await searchParams;
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers")]);
  const fortnight = parseFortnightKey(period) ?? fortnightOf(todayBusinessDate());
  const { effective, closing, documents } = await getSettlementDocuments(tenant.id, fortnight);

  const selected = barber ? documents.filter((d) => d.barberId === barber) : documents;
  if (barber && selected.length === 0) notFound();

  const periodLabel = `${t(fortnight.half === 1 ? "settlements.firstHalf" : "settlements.secondHalf")} · ${fmtDay(fortnight.from)} – ${fmtDay(fortnight.to)}`;
  const status = closing
    ? t("settlements.closedOn", { date: fmtDay(businessDateOf(closing.closedAt)) })
    : t("settlements.preliminary");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 print:max-w-none print:gap-0 print:p-0">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-zinc-500">
          {t("settlementDoc.printHint", { count: selected.length })}
        </p>
        <PrintButton />
      </div>

      {!closing && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 print:hidden">
          {t("settlementDoc.notClosedWarning")}
        </p>
      )}

      {selected.map((d) => (
        <section
          key={d.barberId}
          className="rounded-2xl border border-zinc-200 bg-white p-8 text-black break-after-page dark:border-zinc-800 dark:bg-zinc-950 dark:text-white print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black last:break-after-auto"
        >
          <header className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800 print:border-zinc-300">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">{tenant.name}</p>
              <h1 className="mt-1 text-xl font-semibold">{t("settlementDoc.heading")}</h1>
              <p className="text-sm text-zinc-500">{periodLabel}</p>
            </div>
            <span className="text-xs text-zinc-500">{status}</span>
          </header>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 py-4 text-sm">
            <dt className="text-zinc-500">{t("settlements.colBarber")}</dt>
            <dd className="font-medium">{d.barberName}</dd>
            <dt className="text-zinc-500">{t("paymentDetails.idNumber")}</dt>
            <dd>{d.idNumber ?? "—"}</dd>
            <dt className="text-zinc-500">{t("paymentDetails.iban")}</dt>
            <dd className="font-mono text-xs leading-5">{d.iban ?? "—"}</dd>
            <dt className="text-zinc-500">{t("settlements.colServices")}</dt>
            <dd>{d.serviceCount}</dd>
            <dt className="text-zinc-500">{t("settlementDoc.daysWorked")}</dt>
            <dd>{d.daysWorked}</dd>
          </dl>

          <table className="w-full text-sm">
            <tbody>
              {settlementDocLines(d).map((l) => (
                <tr
                  key={l.key}
                  className={`border-t border-zinc-100 dark:border-zinc-800 print:border-zinc-200 ${l.strong ? "text-base font-semibold" : ""}`}
                >
                  <td className="w-6 py-2 text-zinc-400">{l.sign}</td>
                  <td className="py-2">
                    {t(`settlementDoc.line.${l.key}`)}
                    {l.key === "maintenance" && d.daysWorked > 0 && l.amount > 0 && (
                      <span className="ml-1 text-xs text-zinc-500">
                        ({d.daysWorked} × {fmtColones(effective.settings.maintenanceDailyFee)})
                      </span>
                    )}
                    {l.key === "iva" && (
                      <span className="ml-1 text-xs text-zinc-500">
                        ({Math.round(effective.settings.ivaRate * 10000) / 100}%
                        {d.ivaInformative ? ` · ${t("settlementDoc.ivaInformative")}` : ""})
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmtColones(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {d.shortfall > 0 && (
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-400 print:text-black">
              {t("settlements.shortfall", { amount: fmtColones(d.shortfall) })}
            </p>
          )}

          <p className="mt-6 text-xs text-zinc-500">{t("settlementDoc.footer")}</p>
        </section>
      ))}
    </div>
  );
}
