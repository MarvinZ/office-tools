import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireBarbersPage } from "@/services/barbers/roles";
import { getDemographics, listClients } from "@/services/barbers/clients";
import { listLocations } from "@/services/barbers/locations";
import { listBarbers } from "@/services/barbers/barbers";
import { PAGE_AREAS } from "@/lib/barbers/permissions";
import { fmtDay, todayBusinessDate } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import { ageOn } from "@/lib/barbers/clients";
import { monthOf, monthRange, parseMonthKey, shiftMonth } from "@/lib/barbers/panel";
import { fmtDateTime, monthLabel } from "../panel/_lib/format";
import ClientForm from "./_components/client-form";
import AgeDistribution from "./_components/age-distribution";
import { ageLabels } from "./_lib/labels";

export const dynamic = "force-dynamic";

/** Client records (NOURA Módulo 1 §10–11): search, incomplete records, birthdays, ages. */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; month?: string; locationId?: string; barberId?: string }>;
}) {
  const me = await requireBarbersPage(PAGE_AREAS["/barbers/clients"]);
  const [params, t, locale] = await Promise.all([searchParams, getTranslations("barbers.clients"), getLocale()]);
  const today = todayBusinessDate();
  const currentMonth = monthOf(today);
  const filter = params.filter === "incomplete" || params.filter === "birthdays" ? params.filter : undefined;
  const month = parseMonthKey(params.month) ?? currentMonth;

  const [clients, allLocations, allBarbers] = await Promise.all([
    listClients(me.tenant.id, { q: params.q, filter, month: currentMonth }),
    listLocations(me.tenant.id),
    listBarbers(me.tenant.id),
  ]);
  const locations = allLocations.filter((l) => l.status === "active");
  const location = locations.find((l) => l.id === params.locationId) ?? null;
  const barber = allBarbers.find((b) => b.id === params.barberId) ?? null;
  const demo = await getDemographics(me.tenant.id, { ...monthRange(month), locationId: location?.id ?? null, barberId: barber?.id ?? null }, today);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${
      active
        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
        : "border-zinc-200 text-zinc-600 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
    }`;
  const select = "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";
  const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
  const monthOptions = Array.from({ length: 13 }, (_, i) => shiftMonth(currentMonth, -i));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-black dark:text-white">{t("newTitle")}</h2>
        <ClientForm today={today} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <form className="flex gap-2">
            {filter && <input type="hidden" name="filter" value={filter} />}
            <input name="q" defaultValue={params.q ?? ""} placeholder={t("search")} aria-label={t("search")} className={`${select} w-64`} />
            <button className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">{t("searchButton")}</button>
          </form>
          <Link href="/barbers/clients" className={chip(!filter)}>{t("filterAll")}</Link>
          <Link href="/barbers/clients?filter=incomplete" className={chip(filter === "incomplete")}>{t("filterIncomplete")}</Link>
          <Link href="/barbers/clients?filter=birthdays" className={chip(filter === "birthdays")}>{t("filterBirthdays")}</Link>
        </div>

        {clients.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">{t("empty")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <th className={th}>{t("fullName")}</th>
                    <th className={th}>{t("phone")}</th>
                    <th className={th}>{t("birthday")}</th>
                    <th className={`${th} text-right`}>{t("visits")}</th>
                    <th className={th}>{t("lastVisit")}</th>
                    <th className={`${th} text-right`}>{t("spent")}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                      <td className="px-3 py-2">
                        <Link href={`/barbers/clients/${c.id}`} className="font-medium text-black hover:underline dark:text-white">{c.fullName}</Link>
                        {c.missing.length > 0 && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            {t("incomplete")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">{c.phone ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                        {c.birthDate ? `${fmtDay(c.birthDate)} (${ageOn(c.birthDate, today)})` : "—"}
                        {c.birthdayThisMonth && <span className="ml-1.5" aria-label={t("birthdayThisMonth")}>🎂</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.visits}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">{c.lastVisit ? fmtDateTime(c.lastVisit, locale) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtColones(c.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("demographicsTitle")}</h2>
        <form className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            {t("period")}
            <select name="month" defaultValue={month} className={`${select} capitalize`}>
              {monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m, locale)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            {t("location")}
            <select name="locationId" defaultValue={location?.id ?? ""} className={select}>
              <option value="">{t("allLocations")}</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            {t("professional")}
            <select name="barberId" defaultValue={barber?.id ?? ""} className={select}>
              <option value="">{t("allProfessionals")}</option>
              {allBarbers.map((b) => <option key={b.id} value={b.id}>{b.firstName} {b.lastName}</option>)}
            </select>
          </label>
          <button className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">{t("apply")}</button>
        </form>
        <div className="mt-4 max-w-2xl">
          <AgeDistribution
            data={demo}
            labels={ageLabels(t)}
            totalLabel={t("demographicsTotal", { count: demo.total, month: monthLabel(month, locale) })}
            emptyLabel={t("demographicsEmpty")}
          />
        </div>
      </section>
    </div>
  );
}
