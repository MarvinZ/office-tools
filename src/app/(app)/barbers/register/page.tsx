import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { canUseLocation, requireBarbersPage } from "@/services/barbers/roles";
import { listLocations } from "@/services/barbers/locations";
import { listBarbers } from "@/services/barbers/barbers";
import { getRegisterStatus, getSalesOutsideShifts, getShiftView, listShifts } from "@/services/barbers/cash-register";
import { can, PAGE_AREAS } from "@/lib/barbers/permissions";
import { fmtDay, todayBusinessDate } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import { methodKey } from "@/lib/barbers/cash-register";
import { previousDay } from "@/lib/barbers/panel";
import LocationGate from "../_components/location-gate";
import OpenShiftForm from "./_components/open-shift-form";
import Outflows from "./_components/outflows";
import CloseShiftForm from "./_components/close-shift-form";
import { fmtDateTime } from "../panel/_lib/format";

export const dynamic = "force-dynamic";

/**
 * The cash register (NOURA Módulo 1 §3/§13, replaces the CIERRE GENERAL
 * sheet): open a shift with the float, take cash out, close it counting each
 * payment method. One location at a time, like the Registro.
 */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ locationId?: string }> }) {
  const me = await requireBarbersPage(PAGE_AREAS["/barbers/register"]);
  const [{ locationId }, t, locale, allLocations] = await Promise.all([
    searchParams,
    getTranslations("barbers.register"),
    getLocale(),
    listLocations(me.tenant.id),
  ]);
  const canOperate = can(me.role, "operate");
  const activeLocations = allLocations.filter((l) => l.status === "active" && canUseLocation(me, l.id));
  const location = locationId
    ? activeLocations.find((l) => l.id === locationId) ?? null
    : activeLocations.length === 1
      ? activeLocations[0]
      : null;

  if (!location) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("chooseLocation")}</p>
        </div>
        <LocationGate locations={activeLocations} />
      </div>
    );
  }

  const today = todayBusinessDate();
  let from = today;
  for (let i = 0; i < 13; i++) from = previousDay(from);
  const [status, history, outside, barbers] = await Promise.all([
    getRegisterStatus(me.tenant.id, location.id, today),
    listShifts(me.tenant.id, location.id, from, today),
    getSalesOutsideShifts(me.tenant.id, location.id, today),
    listBarbers(me.tenant.id),
  ]);
  const open = status.shifts[0] ?? null;
  const view = open ? await getShiftView(me.tenant.id, open.id, today) : null;
  const nextShift = history.filter((s) => s.businessDate === today).length + 1;
  const countLines = view
    ? view.closing.lines.filter((l) => l.counts).map((l) => ({ key: methodKey(l.paymentMethodId), name: l.name, kind: l.kind, expected: l.expected }))
    : [];

  const card = "rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6";
  const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
        </div>
        <LocationGate locations={activeLocations} current={location} compact />
      </div>

      {outside.count > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {t("salesOutside", { count: outside.count, amount: fmtColones(outside.total) })}
        </p>
      )}

      {!open || !view ? (
        <section className={card}>
          <div className="flex items-center gap-2">
            <StateBadge state="closed" label={t("state.closed")} />
          </div>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{t("closedBody")}</p>
          {canOperate && (
            <div className="mt-4">
              <OpenShiftForm locationId={location.id} nextShift={nextShift} />
            </div>
          )}
        </section>
      ) : (
        <>
          <section className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge state={open.state} label={t(`state.${open.state}`)} />
              <span className="text-sm font-medium text-black dark:text-white">
                {t("shiftTitle", { n: open.shiftNumber, date: fmtDay(open.businessDate) })}
              </span>
              <span className="text-sm text-zinc-500">
                · {t("openedBy", { name: open.cashierName, when: fmtDateTime(open.openedAt, locale) })}
              </span>
              <Link href={`/barbers/register/${open.id}`} className="ml-auto text-xs text-zinc-500 underline hover:text-black dark:hover:text-white">
                {t("viewPrint")}
              </Link>
            </div>
            {open.state === "closingPending" && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {t("pendingBody", { date: fmtDay(open.businessDate) })}
              </p>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className={th}>{t("method")}</th>
                    <th className={`${th} text-right`}>{t("sales")}</th>
                    <th className={`${th} text-right`}>{t("expected")}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.closing.lines.map((l) => (
                    <tr key={methodKey(l.paymentMethodId)} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                      <td className="px-3 py-2 text-black dark:text-white">
                        {l.name}
                        {!l.counts && <span className="ml-2 text-xs text-zinc-400">{t("notCounted")}</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtColones(l.sales)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.counts ? fmtColones(l.expected) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {t("cashFormula", { opening: fmtColones(view.closing.openingCash), outflows: fmtColones(view.closing.outflows) })} ·{" "}
              {t("counts", { services: view.serviceCount, products: view.productCount })}
            </p>
          </section>

          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold text-black dark:text-white">{t("outflowsTitle")}</h2>
            <Outflows
              shiftId={open.id}
              outflows={view.outflows}
              barbers={barbers.filter((b) => b.status === "active").map((b) => ({ id: b.id, name: `${b.firstName} ${b.lastName}`.trim() }))}
              canEdit={canOperate}
            />
          </section>

          {canOperate && (
            <section className={card}>
              <h2 className="text-sm font-semibold text-black dark:text-white">{t("closeTitle", { n: open.shiftNumber })}</h2>
              <p className="mb-4 mt-1 text-xs text-zinc-500">{t("closeHint")}</p>
              <CloseShiftForm shiftId={open.id} lines={countLines} />
            </section>
          )}
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("historyTitle")}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("noHistory")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <th className={th}>{t("date")}</th>
                    <th className={th}>{t("shift")}</th>
                    <th className={th}>{t("cashier")}</th>
                    <th className={`${th} text-right`}>{t("expected")}</th>
                    <th className={`${th} text-right`}>{t("counted")}</th>
                    <th className={`${th} text-right`}>{t("difference")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                      <td className="whitespace-nowrap px-3 py-2">{fmtDay(s.businessDate)}</td>
                      <td className="px-3 py-2">
                        <Link href={`/barbers/register/${s.id}`} className="underline decoration-dotted hover:text-black dark:hover:text-white">
                          {t("shiftN", { n: s.shiftNumber })}
                        </Link>
                        {s.status === "open" && <span className="ml-2 text-xs text-zinc-500">{t("state.open")}</span>}
                      </td>
                      <td className="px-3 py-2">{s.cashierName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.expectedTotal == null ? "—" : fmtColones(s.expectedTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.countedTotal == null ? "—" : fmtColones(s.countedTotal)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${s.difference && s.difference > 0 ? "font-medium text-red-700 dark:text-red-400" : "text-zinc-500"}`}>
                        {s.difference == null
                          ? "—"
                          : s.difference > 0
                            ? t("missing", { amount: fmtColones(s.difference) })
                            : s.difference < 0
                              ? t("extra", { amount: fmtColones(-s.difference) })
                              : t("balanced")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const STATE_CLS = {
  closed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  open: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  closingPending: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
} as const;

function StateBadge({ state, label }: { state: keyof typeof STATE_CLS; label: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATE_CLS[state]}`}>{label}</span>;
}
