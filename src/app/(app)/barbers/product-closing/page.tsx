import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getProductClosing } from "@/services/barbers/product-commissions";
import { listProducts } from "@/services/barbers/products";
import { listPaymentMethods } from "@/services/barbers/payment-methods";
import { listBarbers } from "@/services/barbers/barbers";
import { getBarberSettings } from "@/services/barbers/settings";
import { fmtDay, isDateString, todayBusinessDate } from "@/lib/barbers/dates";
import { fortnightOf, shiftFortnight } from "@/lib/barbers/settlement";
import { fmtColones } from "@/lib/barbers/currency";
import CustomerSaleForm from "./_components/customer-sale-form";
import { MarkPaidControl, SaleRowActions } from "./_components/closing-actions";

export const dynamic = "force-dynamic";

/** Monday–Sunday week containing `date`. */
function weekOf(date: string): { from: string; to: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

/**
 * Product sales to customers and the product closing (Brayan, Nov 2026): a
 * separate closing by date range — weekly or by fortnight — with commissions
 * per collaborator, paid or pending, never mixed into the service settlement.
 */
export default async function ProductClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers.productClosing")]);
  const today = todayBusinessDate();
  const current = fortnightOf(today);
  const from = isDateString(params.from) ? params.from! : current.from;
  const to = isDateString(params.to) && params.to! >= from ? params.to! : current.to;

  const [closing, products, methods, barbers, settings] = await Promise.all([
    getProductClosing(tenant.id, from, to),
    listProducts(tenant.id),
    listPaymentMethods(tenant.id),
    listBarbers(tenant.id),
    getBarberSettings(tenant.id),
  ]);
  const { summary } = closing;
  const week = weekOf(today);
  const previous = shiftFortnight(current, -1);
  const ranges = [
    { label: t("thisWeek"), ...week },
    { label: t("thisFortnight"), from: current.from, to: current.to },
    { label: t("lastFortnight"), from: previous.from, to: previous.to },
  ];

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${
      active
        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
        : "border-zinc-200 text-zinc-600 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
    }`;
  const th = "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500";
  const td = "px-4 py-2.5";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <CustomerSaleForm
        products={products
          .filter((p) => p.status === "active")
          .map((p) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            commissionAmount: Number(p.commissionAmount),
            chargesIva: p.chargesIva,
          }))}
        barbers={barbers.filter((b) => b.status === "active").map((b) => ({ id: b.id, name: `${b.firstName} ${b.lastName}`.trim() }))}
        paymentMethods={methods.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name }))}
        ivaRate={settings.ivaRate}
        today={today}
      />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-semibold text-black dark:text-white">{t("closingTitle")}</h2>
          {ranges.map((r) => (
            <Link key={r.label} href={`/barbers/product-closing?from=${r.from}&to=${r.to}`} className={chip(r.from === from && r.to === to)}>
              {r.label}
            </Link>
          ))}
          <form className="flex items-center gap-1 text-xs text-zinc-500">
            <input type="date" name="from" defaultValue={from} aria-label={t("from")} className="rounded-md border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900" />
            –
            <input type="date" name="to" defaultValue={to} aria-label={t("to")} className="rounded-md border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900" />
            <button className="rounded-md border border-zinc-200 px-2 py-1 hover:text-black dark:border-zinc-700 dark:hover:text-white">{t("show")}</button>
          </form>
          <a
            href={`/barbers/product-closing/export?from=${from}&to=${to}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
          >
            <FileSpreadsheet size={14} /> Excel
          </a>
        </div>
        <p className="text-sm text-zinc-500">{fmtDay(from)} – {fmtDay(to)}</p>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            [t("sold"), summary.subtotal],
            [t("iva"), summary.ivaAmount],
            [t("charged"), summary.total],
            [t("commissions"), summary.commissions],
            [t("paid"), summary.commissionsPaid],
            [t("pending"), summary.commissionsPending],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-black dark:text-white">{fmtColones(Number(value))}</dd>
            </div>
          ))}
        </dl>

        {summary.byBarber.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-900">
                    <th className={th}>{t("collaborator")}</th>
                    <th className={`${th} text-right`}>{t("salesCount")}</th>
                    <th className={`${th} text-right`}>{t("commissions")}</th>
                    <th className={`${th} text-right`}>{t("paid")}</th>
                    <th className={`${th} text-right`}>{t("pending")}</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byBarber.map((b) => (
                    <tr key={b.barberId} className="border-b border-zinc-100 last:border-0 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                      <td className={`${td} font-medium text-black dark:text-white`}>{closing.barberNames[b.barberId]}</td>
                      <td className={`${td} text-right tabular-nums`}>{b.sales}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtColones(b.commissions)}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtColones(b.paid)}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtColones(b.pending)}</td>
                      <td className={`${td} text-right`}>
                        {b.pending > 0 && <MarkPaidControl barberId={b.barberId} from={from} to={to} today={today} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-900">
                  <th className={th}>{t("date")}</th>
                  <th className={th}>{t("product")}</th>
                  <th className={`${th} text-right`}>{t("quantity")}</th>
                  <th className={`${th} text-right`}>{t("charged")}</th>
                  <th className={`${th} text-right`}>{t("commission")}</th>
                  <th className={th}>{t("collaborator")}</th>
                  <th className={th}>{t("status")}</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {closing.sales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-400">{t("empty")}</td>
                  </tr>
                ) : (
                  closing.sales.map((s) => (
                    <tr key={s.id} className="border-b border-zinc-100 last:border-0 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                      <td className={`${td} whitespace-nowrap`}>{fmtDay(s.saleDate)}</td>
                      <td className={`${td} text-black dark:text-white`}>{s.productName}</td>
                      <td className={`${td} text-right tabular-nums`}>{s.quantity}</td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                        {fmtColones(s.total)}
                        {s.ivaAmount > 0 && <span className="block text-xs text-zinc-400">{t("inclIva", { iva: fmtColones(s.ivaAmount) })}</span>}
                      </td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{fmtColones(s.commissionTotal)}</td>
                      <td className={td}>{s.barberName ?? "—"}</td>
                      <td className={`${td} whitespace-nowrap text-xs`}>
                        {s.commissionTotal === 0 ? (
                          "—"
                        ) : s.commissionPaidAt ? (
                          <span className="text-green-700 dark:text-green-400">
                            {t("paidOnDate", { date: fmtDay(s.commissionPaidAt) })}
                            {s.paidAsCashOutflow ? ` · ${t("cashOutflow")}` : ""}
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400">{t("pending")}</span>
                        )}
                      </td>
                      <td className={`${td} text-right`}>
                        <SaleRowActions saleId={s.id} paid={s.commissionPaidAt != null} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
