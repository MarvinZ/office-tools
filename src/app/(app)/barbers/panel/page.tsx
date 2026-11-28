import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { currentUser } from "@clerk/nextjs/server";
import { CalendarPlus, FileBarChart, MessageCircle, QrCode, ShoppingCart, UserPlus, Wallet, type LucideIcon } from "lucide-react";
import { requireBarbersPage } from "@/services/barbers/roles";
import { getPanelConfig, getPanelData } from "@/services/barbers/panel";
import { can, PAGE_AREAS } from "@/lib/barbers/permissions";
import { businessDateOf, fmtDay, todayBusinessDate } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import { fortnightRange, parseFortnightKey } from "@/lib/barbers/settlement";
import { monthOf, parseMonthKey, shiftMonth, type GoalProgress, type Recommendation } from "@/lib/barbers/panel";
import PanelHeader from "./_components/panel-header";
import GoalsEditor from "./_components/goals-editor";
import RecommendationList, { type RecommendationItem } from "./_components/recommendation-list";
import { detailHref, fmtDateTime, fmtPercent, fmtSignedColones, monthDetailHref, monthLabel } from "./_lib/format";
import AgeDistribution from "../clients/_components/age-distribution";
import { ageLabels } from "../clients/_lib/labels";
import { ageOn, whatsappLink } from "@/lib/barbers/clients";

export const dynamic = "force-dynamic";

/**
 * Panel general del administrador (NOURA Módulo 1). Built in the spec's
 * priority order: access, (cash state: pending module), daily figures, monthly
 * figures, comparison, traceability, recommendations. Sections that need a
 * module we don't have yet (appointments, client records, cash register,
 * expenses) say so instead of showing zeros.
 */
export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; a?: string; b?: string }>;
}) {
  const me = await requireBarbersPage(PAGE_AREAS["/barbers/panel"]);
  const [params, t, locale, tc, user] = await Promise.all([
    searchParams,
    getTranslations("barbers.panel"),
    getLocale(),
    getTranslations("barbers.clients"),
    currentUser(),
  ]);

  const today = todayBusinessDate();
  const currentMonth = monthOf(today);
  const compareA = parseMonthKey(params.a) ?? currentMonth;
  const compareB = parseMonthKey(params.b) ?? shiftMonth(compareA, -1);
  const requested = params.locationId && params.locationId !== "all" ? params.locationId : null;

  // A location id that isn't one of this tenant's active locations is ignored.
  const config = await getPanelConfig(me.tenant.id);
  const locationId = requested && config.locations.some((l) => l.id === requested) ? requested : null;
  const data = await getPanelData(me.tenant.id, { today, locationId, compareA, compareB, config });

  const name = user?.firstName || user?.fullName || user?.username || "";
  const monthRangeToday = { from: `${currentMonth}-01`, to: today };
  const recItems: RecommendationItem[] = data.recommendations.map((r) => ({
    key: r.key,
    category: r.category,
    message: recommendationMessage(r, t, locale),
    href: r.href,
    decision: r.decision ? { status: r.decision.status, when: fmtDateTime(r.decision.decidedAt, locale) } : null,
  }));
  const monthOptions = Array.from({ length: 13 }, (_, i) => shiftMonth(currentMonth, -i));
  const sellHref = locationId ? `/barbers?locationId=${locationId}` : "/barbers";
  const registerHref = locationId ? `/barbers/register?locationId=${locationId}` : "/barbers/register";
  const reg = data.register;
  const regShift = reg.shifts.find((s) => s.state === reg.state) ?? null;
  const registerLabel =
    reg.state === "open" && regShift
      ? `${t("cash")}: ${t("register.open")} · ${t("register.shift", { n: regShift.shiftNumber })} · ${regShift.cashierName}`
      : `${t("cash")}: ${t(`register.${reg.state}`)}`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <PanelHeader
        name={name}
        initialNow={data.generatedAt.toISOString()}
        locations={data.config.locations.map((l) => ({ id: l.id, name: l.name }))}
        locationId={locationId}
      />

      {/* ── Today + quick actions ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${card} lg:col-span-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={h2}>{t("day.title")}</h2>
            <Link
              href={registerHref}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:underline ${REGISTER_CLS[reg.state]}`}
            >
              <Wallet size={13} aria-hidden />
              {registerLabel}
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Link href={detailHref({ from: today, to: today }, locationId)} className="group block">
                <p className={label}>{t("day.sales")}</p>
                <p className={`${bigNumber} group-hover:underline`}>{fmtColones(data.day.sales.total)}</p>
                <p className="text-xs text-zinc-500">{t("day.services", { count: data.day.sales.services.count })}</p>
              </Link>
              <div className="mt-3">
                {data.day.goal ? (
                  <GoalBar progress={data.day.goal} caption={`${t("day.progress", { percent: fmtPercent(data.day.goal.percent, locale).replace("%", "") })} · ${t("day.goal")} ${fmtColones(data.day.goal.goal)}`} />
                ) : (
                  <p className="text-xs text-zinc-400">
                    {t("day.noGoal")} · <a href="#goals" className="underline">{t("goal.setGoals")}</a>
                  </p>
                )}
              </div>
              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{dayMessageText(data.day.message, t)}</p>
            </div>
            <div className="flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <PendingFigure title={t("day.reservations")} note={t("needsAgenda")} pending={t("pending")} />
              <PendingFigure title={t("day.nextAppointment")} note={t("needsAgenda")} pending={t("pending")} />
            </div>
          </div>
        </section>

        <section className={card}>
          <h2 className={h2}>{t("actions.title")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <QuickAction href={sellHref} icon={ShoppingCart} label={t("actions.sell")} />
            <QuickAction icon={CalendarPlus} label={t("actions.newAppointment")} soon={t("comingSoon")} />
            <QuickAction icon={UserPlus} label={t("actions.newClient")} soon={t("comingSoon")} />
            <QuickAction
              href={registerHref}
              icon={Wallet}
              label={reg.state === "closed" ? t("actions.cashRegister") : reg.state === "open" ? t("actions.goToRegister") : t("actions.registerPending")}
            />
            <QuickAction icon={QrCode} label={t("actions.qr")} soon={t("comingSoon")} />
            <QuickAction href="/barbers/reports" icon={FileBarChart} label={t("actions.reports")} />
          </div>
        </section>
      </div>

      {/* ── Month at a glance ── */}
      <section className="flex flex-col gap-3">
        <h2 className={h2}>
          {t("month.title")} · <span className="font-normal capitalize text-zinc-500">{monthLabel(currentMonth, locale)}</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href={detailHref(monthRangeToday, locationId)} className={`${card} group`}>
            <p className={label}>{t("month.sales")}</p>
            <p className={`${bigNumber} group-hover:underline`}>{fmtColones(data.month.sales.total)}</p>
            <p className="text-xs text-zinc-500">
              {data.month.vsPrevious.percent === null
                ? t("month.notComparable")
                : t("month.vsPrevious", {
                    diff: fmtSignedColones(data.month.vsPrevious.diff),
                    percent: fmtPercent(data.month.vsPrevious.percent, locale, true),
                    month: monthLabel(shiftMonth(currentMonth, -1), locale),
                  })}
            </p>
          </Link>
          <Link href={detailHref(monthRangeToday, locationId)} className={`${card} group`}>
            <p className={label}>{t("month.services")}</p>
            <p className={`${bigNumber} group-hover:underline`}>{fmtColones(data.month.sales.services.amount)}</p>
            <p className="text-xs text-zinc-500">{t("month.serviceCount", { count: data.month.sales.services.count })}</p>
          </Link>
          <Link href={detailHref(monthRangeToday, locationId)} className={`${card} group`}>
            <p className={label}>{t("month.products")}</p>
            <p className={`${bigNumber} group-hover:underline`}>{fmtColones(data.month.sales.products.amount)}</p>
            <p className="text-xs text-zinc-500">{t("month.productUnits", { count: data.month.sales.products.units })}</p>
          </Link>
          <div className={card}>
            <PendingFigure title={t("month.reservations")} note={t("needsAgenda")} pending={t("pending")} />
          </div>
          <Link href="/barbers/clients" className={`${card} group`}>
            <p className={label}>{t("month.clients")}</p>
            <p className={`${bigNumber} group-hover:underline`}>{data.clients.current.clients}</p>
            <p className="text-xs text-zinc-500">
              {t("month.newReturning", { new: data.clients.current.newClients, returning: data.clients.current.returning })}
              {" · "}
              {data.clients.vsPrevious.percent === null
                ? t("month.notComparable")
                : t("month.clientsVsPrevious", { percent: fmtPercent(data.clients.vsPrevious.percent, locale, true) })}
            </p>
            {data.clients.current.unidentified > 0 && (
              <p className="text-xs text-zinc-400">{t("month.unidentified", { count: data.clients.current.unidentified })}</p>
            )}
          </Link>
          <Link href={`/barbers/expenses?month=${currentMonth}${locationId ? `&locationId=${locationId}` : ""}`} className={`${card} group`}>
            <p className={label}>{t("month.expenses")}</p>
            <p className={`${bigNumber} group-hover:underline`}>{fmtColones(data.month.expenses.current)}</p>
            <p className="text-xs text-zinc-500">
              {data.month.expenses.percent === null
                ? t("month.notComparable")
                : t("month.vsPrevious", {
                    diff: fmtSignedColones(data.month.expenses.diff),
                    percent: fmtPercent(data.month.expenses.percent, locale, true),
                    month: monthLabel(shiftMonth(currentMonth, -1), locale),
                  })}
            </p>
          </Link>
        </div>
      </section>

      {/* ── Monthly goal + comparison ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h2 className={h2}>{t("goal.title")}</h2>
          {data.month.goal ? (
            <div className="mt-4 flex flex-col gap-4">
              <GoalBar
                progress={data.month.goal}
                caption={data.month.goal.reached ? `${t("goal.reached")} · ${fmtPercent(data.month.goal.percent, locale)}` : t("goal.progress", { percent: fmtPercent(data.month.goal.percent, locale).replace("%", "") })}
              />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Figure term={t("goal.goal")} value={fmtColones(data.month.goal.goal)} />
                <Figure term={t("goal.sold")} value={fmtColones(data.month.goal.sales)} />
                <Figure term={t("goal.remaining")} value={fmtColones(data.month.goal.remaining)} />
                <Figure
                  term={t("goal.requiredDaily")}
                  value={data.month.goal.requiredDaily === null ? t("goal.noDaysLeft") : fmtColones(data.month.goal.requiredDaily)}
                  note={t("goal.daysLeft", { count: data.month.goal.daysRemaining })}
                />
              </dl>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">
              {t("goal.noGoal")} <a href="#goals" className="underline">{t("goal.setGoals")}</a>
            </p>
          )}
        </section>

        <section className={card}>
          <h2 className={h2}>{t("compare.title")}</h2>
          <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
            {locationId && <input type="hidden" name="locationId" value={locationId} />}
            <MonthSelect name="a" label={t("compare.monthA")} value={compareA} options={monthOptions} locale={locale} />
            <MonthSelect name="b" label={t("compare.monthB")} value={compareB} options={monthOptions} locale={locale} />
            <button type="submit" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-black hover:border-zinc-400 dark:border-zinc-700 dark:text-white">
              {t("compare.apply")}
            </button>
          </form>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-3 font-semibold">{t("compare.colIndicator")}</th>
                  <th className="py-2 pr-3 text-right font-semibold capitalize">{monthLabel(compareA, locale)}</th>
                  <th className="py-2 pr-3 text-right font-semibold capitalize">{monthLabel(compareB, locale)}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("compare.colDiff")}</th>
                  <th className="py-2 text-right font-semibold">{t("compare.colPercent")}</th>
                </tr>
              </thead>
              <tbody>
                {data.comparison.rows.map(({ key, cmp }) => {
                  const money = key !== "serviceCount";
                  const fmt = (n: number) => (money ? fmtColones(n) : String(n));
                  const hrefFor = (m: string) =>
                    key === "expenses"
                      ? `/barbers/expenses?month=${m}${locationId ? `&locationId=${locationId}` : ""}`
                      : monthDetailHref(m, locationId);
                  return (
                    <tr key={key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                      <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{t(`compare.rows.${key}`)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        <Link href={hrefFor(compareA)} className="hover:underline">{fmt(cmp.current)}</Link>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        <Link href={hrefFor(compareB)} className="hover:underline">{fmt(cmp.base)}</Link>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{money ? fmtSignedColones(cmp.diff) : `${cmp.diff > 0 ? "+" : ""}${cmp.diff}`}</td>
                      <td className="py-2 text-right tabular-nums">
                        {cmp.percent === null ? <span className="text-xs text-zinc-400">{t("compare.notComparable")}</span> : fmtPercent(cmp.percent, locale, true)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Recommendations ── */}
      <section className={card}>
        <h2 className={h2}>{t("recs.title")}</h2>
        <div className="mt-2">
          <RecommendationList items={recItems} />
        </div>
      </section>

      {/* ── Client activity ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${card} lg:col-span-2`}>
          <h2 className={h2}>{t("visits.title")}</h2>
          {data.recentVisits.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">{t("visits.empty")}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                    {["colWhen", "colCustomer", "colService", "colBarber", "colMethod"].map((c) => (
                      <th key={c} className="py-2 pr-3 font-semibold">{t(`visits.${c}`)}</th>
                    ))}
                    <th className="py-2 text-right font-semibold">{t("visits.colTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentVisits.map((v) => {
                    const day = businessDateOf(v.performedAt);
                    return (
                      <tr key={v.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                          <Link href={detailHref({ from: day, to: day }, v.locationId)} className="hover:underline" title={t("visits.seeDay")}>
                            {fmtDateTime(v.performedAt, locale)}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {v.clientId ? (
                            <Link href={`/barbers/clients/${v.clientId}`} className="hover:underline">{v.customerName}</Link>
                          ) : (
                            v.customerName ?? <span className="text-zinc-400 italic">{t("visits.noName")}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                          {v.service}
                          {v.status !== "active" && (
                            <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              {t(`visits.${v.status as "courtesy" | "warranty"}`)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{v.barberName}</td>
                        <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{v.paymentMethodName}</td>
                        <td className="py-2 text-right tabular-nums">{fmtColones(v.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="flex flex-col gap-4">
          <section className={card}>
            <h2 className={h2}>{t("birthdays")}</h2>
            {data.clients.birthdays.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">{t("noBirthdays")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                {data.clients.birthdays.slice(0, 8).map((b) => {
                  const wa = whatsappLink(b.phone, tc("birthdayMessage", { name: b.fullName.split(" ")[0], business: me.tenant.name }));
                  return (
                    <li key={b.id} className="flex items-start gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/barbers/clients/${b.id}`} className="font-medium text-black hover:underline dark:text-white">{b.fullName}</Link>
                        <p className="text-xs text-zinc-500">
                          {fmtDay(b.birthday)} · {t("turns", { age: ageOn(b.birthDate, b.birthday) })}
                          {b.phone && <> · {b.phone}</>}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {b.lastVisit ? t("lastVisit", { when: fmtDateTime(b.lastVisit, locale) }) : t("noVisits")}
                          {b.usualBarberName && <> · {b.usualBarberName}</>}
                        </p>
                      </div>
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer" title={t("prepareMessage")} aria-label={t("prepareMessage")} className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white">
                          <MessageCircle size={14} />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-zinc-400">{t("messageNote")}</p>
          </section>
          <section className={card}>
            <h2 className={`${h2} mb-3`}>{t("demographics")}</h2>
            <AgeDistribution
              data={data.clients.ages}
              labels={ageLabels(tc)}
              totalLabel={tc("demographicsTotal", { count: data.clients.ages.total, month: monthLabel(currentMonth, locale) })}
              emptyLabel={tc("demographicsEmpty")}
            />
          </section>
        </div>
      </div>

      <GoalsEditor config={data.config} canEdit={can(me.role, "configure")} />

      <footer className="flex flex-col gap-1 text-xs text-zinc-400">
        <p>{t("salesDefinition")}</p>
        <p>
          {t("updatedAt", { when: fmtDateTime(data.generatedAt, locale) })} · {locationId ? data.config.locations.find((l) => l.id === locationId)?.name : t("allLocations")}
        </p>
      </footer>
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

/** Closed is neutral, open is green, a pending closing is red; the text says it too. */
const REGISTER_CLS = {
  closed: "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300",
  open: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  closingPending: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
} as const;

const card = "rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5";
const h2 = "text-sm font-semibold text-black dark:text-white";
const label = "text-xs font-medium text-zinc-500";
const bigNumber = "mt-1 text-2xl font-semibold tabular-nums text-black dark:text-white";

type T = Awaited<ReturnType<typeof getTranslations<"barbers.panel">>>;

function dayMessageText(m: Awaited<ReturnType<typeof getPanelData>>["day"]["message"], t: T): string {
  switch (m.key) {
    case "dailyGoalRemaining":
    case "salesSoFar":
      return t(`dayMessage.${m.key}`, { amount: fmtColones(m.amount) });
    default:
      return t(`dayMessage.${m.key}`);
  }
}

function fortnightLabel(key: string): string {
  const f = parseFortnightKey(key);
  if (!f) return key;
  const r = fortnightRange(f.year, f.month, f.half);
  return `${fmtDay(r.from)} – ${fmtDay(r.to)}`;
}

function recommendationMessage(r: Recommendation, t: T, locale: string): string {
  const v = r.values;
  switch (r.code) {
    case "expensesPending":
      return t("recs.expensesPending", { count: Number(v.count), amount: fmtColones(Number(v.amount)) });
    case "registerClosingPending":
      return t("recs.registerClosingPending", { location: String(v.location), shift: Number(v.shift), date: fmtDay(String(v.date)) });
    case "fortnightUnclosed":
      return t("recs.fortnightUnclosed", { period: fortnightLabel(String(v.period)) });
    case "goalBehind":
      return t("recs.goalBehind", {
        month: monthLabel(String(v.month), locale),
        sales: fmtColones(Number(v.sales)),
        expected: fmtColones(Number(v.expected)),
        requiredDaily: fmtColones(Number(v.requiredDaily)),
      });
    case "goalReached":
      return t("recs.goalReached", {
        month: monthLabel(String(v.month), locale),
        percent: fmtPercent(Number(v.percent), locale).replace("%", ""),
        goal: fmtColones(Number(v.goal)),
      });
    case "commissionsPending":
      return t("recs.commissionsPending", { count: Number(v.count), amount: fmtColones(Number(v.amount)) });
    case "noSalesYesterday":
      return t("recs.noSalesYesterday", { location: String(v.location), date: fmtDay(String(v.date)) });
  }
}

function GoalBar({ progress, caption }: { progress: GoalProgress; caption: string }) {
  const width = Math.min(100, Math.max(0, progress.percent));
  return (
    <div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-label={caption}
        className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
      >
        <div
          className={`h-full rounded-full ${progress.reached ? "bg-green-600 dark:bg-green-500" : "bg-black dark:bg-white"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-zinc-500">{caption}</p>
    </div>
  );
}

function Figure({ term, value, note }: { term: string; value: string; note?: string }) {
  return (
    <div>
      <dt className={label}>{term}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-black dark:text-white">{value}</dd>
      {note && <dd className="text-xs text-zinc-400">{note}</dd>}
    </div>
  );
}

/** A figure whose data the system doesn't record yet: never shown as zero. */
function PendingFigure({ title, note, pending }: { title: string; note: string; pending: string }) {
  return (
    <div>
      <p className={label}>{title}</p>
      <p className="mt-1 text-sm font-medium text-zinc-400">{pending}</p>
      <p className="text-xs text-zinc-400">{note}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label: text, soon }: { href?: string; icon: LucideIcon; label: string; soon?: string }) {
  const cls = "flex flex-col items-start gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium";
  if (!href) {
    return (
      <div aria-disabled className={`${cls} cursor-not-allowed border-dashed border-zinc-200 text-zinc-400 dark:border-zinc-800`}>
        <Icon size={18} aria-hidden />
        <span>{text}</span>
        <span className="text-xs font-normal">{soon}</span>
      </div>
    );
  }
  return (
    <Link href={href} className={`${cls} border-zinc-200 text-black hover:border-zinc-400 dark:border-zinc-700 dark:text-white dark:hover:border-zinc-500`}>
      <Icon size={18} aria-hidden />
      <span>{text}</span>
    </Link>
  );
}

function MonthSelect({ name, label: text, value, options, locale }: { name: string; label: string; value: string; options: string[]; locale: string }) {
  const all = options.includes(value) ? options : [value, ...options];
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
      {text}
      <select
        name={name}
        defaultValue={value}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm capitalize text-black outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
      >
        {all.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m, locale)}
          </option>
        ))}
      </select>
    </label>
  );
}
