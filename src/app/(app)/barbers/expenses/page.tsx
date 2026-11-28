import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireBarbersPage } from "@/services/barbers/roles";
import { listExpenses } from "@/services/barbers/expenses";
import { listLocations } from "@/services/barbers/locations";
import { can, PAGE_AREAS } from "@/lib/barbers/permissions";
import { todayBusinessDate } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import { summarizeExpenses, type ExpenseStatus } from "@/lib/barbers/expenses";
import { monthOf, monthRange, parseMonthKey, shiftMonth } from "@/lib/barbers/panel";
import { monthLabel } from "../panel/_lib/format";
import ExpenseForm from "./_components/expense-form";
import ExpenseList from "./_components/expense-list";

export const dynamic = "force-dynamic";

const STATUSES: ExpenseStatus[] = ["pending", "approved", "rejected"];

/**
 * Operating expenses by month (NOURA Módulo 1 §6). Admins record, approve and
 * correct them; the accountant reads. Cash taken out of the register as a
 * salon expense shows up here as pending.
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; locationId?: string; status?: string }>;
}) {
  const me = await requireBarbersPage(PAGE_AREAS["/barbers/expenses"]);
  const [params, t, locale, allLocations] = await Promise.all([
    searchParams,
    getTranslations("barbers.expenses"),
    getLocale(),
    listLocations(me.tenant.id),
  ]);
  const today = todayBusinessDate();
  const month = parseMonthKey(params.month) ?? monthOf(today);
  const locations = allLocations.filter((l) => l.status === "active").map((l) => ({ id: l.id, name: l.name }));
  const location = locations.find((l) => l.id === params.locationId) ?? null;
  const status = STATUSES.find((s) => s === params.status) ?? null;
  const canManage = can(me.role, "settle");

  const rows = await listExpenses(me.tenant.id, { ...monthRange(month), locationId: location?.id ?? null });
  const summary = summarizeExpenses(rows);
  const shown = status ? rows.filter((r) => r.status === status) : rows;

  const query = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { month, locationId: location?.id ?? null, status, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/barbers/expenses?${p.toString()}`;
  };
  const nav = "inline-flex items-center rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:text-black dark:border-zinc-700 dark:hover:text-white";
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${
      active
        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
        : "border-zinc-200 text-zinc-600 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
    }`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      {canManage && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-black dark:text-white">{t("newTitle")}</h2>
          <ExpenseForm locations={locations} today={today} />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link href={query({ month: shiftMonth(month, -1) })} className={nav} aria-label={t("prev")}>
          <ChevronLeft size={16} />
        </Link>
        <span className="text-sm font-medium capitalize text-black dark:text-white">{monthLabel(month, locale)}</span>
        <Link href={query({ month: shiftMonth(month, 1) })} className={nav} aria-label={t("next")}>
          <ChevronRight size={16} />
        </Link>
        {locations.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Link href={query({ locationId: null })} className={chip(!location)}>{t("allLocations")}</Link>
            {locations.map((l) => (
              <Link key={l.id} href={query({ locationId: l.id })} className={chip(location?.id === l.id)}>{l.name}</Link>
            ))}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <dt className="text-xs text-zinc-500">{t("approvedTotal")}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-black dark:text-white">{fmtColones(summary.approved)}</dd>
        </div>
        <Link href={query({ status: "pending" })} className="rounded-xl border border-zinc-200 p-3 hover:border-zinc-400 dark:border-zinc-800">
          <dt className="text-xs text-zinc-500">{t("pendingTotal", { count: summary.pendingCount })}</dt>
          <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${summary.pendingCount ? "text-amber-700 dark:text-amber-400" : "text-black dark:text-white"}`}>
            {fmtColones(summary.pending)}
          </dd>
        </Link>
        <div className="col-span-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <dt className="text-xs text-zinc-500">{t("byCategory")}</dt>
          <dd className="mt-1 flex flex-col gap-0.5 text-sm">
            {summary.byCategory.length === 0 ? (
              <span className="text-zinc-400">—</span>
            ) : (
              summary.byCategory.slice(0, 5).map((c) => (
                <span key={c.category} className="flex justify-between gap-3">
                  <span className="text-zinc-600 dark:text-zinc-300">{t(`categories.${c.category}`)}</span>
                  <span className="tabular-nums">{fmtColones(c.amount)}</span>
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1.5">
        <Link href={query({ status: null })} className={chip(!status)}>{t("all")}</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={query({ status: s })} className={chip(status === s)}>{t(`status.${s}`)}</Link>
        ))}
      </div>

      <ExpenseList
        items={shown.map((r) => ({
          id: r.id,
          expenseDate: r.expenseDate,
          category: r.category,
          description: r.description,
          amount: Number(r.amount),
          paidWith: r.paidWith,
          status: r.status as ExpenseStatus,
          locationId: r.locationId,
          locationName: r.locationName,
          fromRegister: r.cashOutflowId != null,
          rejectReason: r.rejectReason,
        }))}
        canManage={canManage}
        locations={locations}
        today={today}
      />
      <p className="text-xs text-zinc-400">{t("footnote")}</p>
    </div>
  );
}
