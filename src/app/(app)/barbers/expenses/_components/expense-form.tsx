"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { unwrap } from "@/lib/barbers/errors";
import { EXPENSE_CATEGORIES, PAID_WITH, type ExpenseInput } from "@/lib/barbers/expenses";
import { createExpenseAction, updateExpenseAction } from "../actions";

export type ExpenseFormValues = ExpenseInput & { id?: string; fromRegister?: boolean };

/**
 * Record an expense, or edit one. An expense that came out of the register
 * keeps its amount, date, location and "cash" (those belong to the register).
 */
export default function ExpenseForm({
  locations,
  today,
  initial,
  onDone,
}: {
  locations: { id: string; name: string }[];
  today: string;
  initial?: ExpenseFormValues;
  onDone?: () => void;
}) {
  const t = useTranslations("barbers.expenses");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const locked = initial?.fromRegister ?? false;
  const [v, setV] = useState({
    locationId: initial?.locationId ?? "",
    expenseDate: initial?.expenseDate ?? today,
    category: initial?.category ?? "supplies",
    description: initial?.description ?? "",
    amount: initial ? String(initial.amount) : "",
    paidWith: initial?.paidWith ?? "cash",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const amount = Number(v.amount);
    if (!v.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError(t("errorRequired"));
      return;
    }
    const input: ExpenseInput = { ...v, amount, locationId: v.locationId || null };
    startTransition(async () => {
      try {
        await unwrap(initial?.id ? updateExpenseAction(initial.id, input) : createExpenseAction(input));
        setSaved(true);
        if (!initial?.id) setV((s) => ({ ...s, description: "", amount: "" }));
        router.refresh();
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const input =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const label = "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className={label}>
          {t("date")}
          <input type="date" required disabled={locked} value={v.expenseDate} onChange={(e) => setV({ ...v, expenseDate: e.target.value })} className={input} />
        </label>
        <label className={label}>
          {t("category")}
          <select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} className={input}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`categories.${c}`)}</option>
            ))}
          </select>
        </label>
        <label className={`${label} lg:col-span-2`}>
          {t("description")}
          <input type="text" required value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className={input} />
        </label>
        <label className={label}>
          {t("amount")}
          <input type="number" min="0" step="0.01" inputMode="decimal" required disabled={locked} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className={`${input} tabular-nums`} />
        </label>
        <label className={label}>
          {t("paidWithLabel")}
          <select disabled={locked} value={v.paidWith} onChange={(e) => setV({ ...v, paidWith: e.target.value })} className={input}>
            {PAID_WITH.map((p) => (
              <option key={p} value={p}>{t(`paidWith.${p}`)}</option>
            ))}
          </select>
        </label>
        <label className={`${label} lg:col-span-2`}>
          {t("location")}
          <select disabled={locked} value={v.locationId} onChange={(e) => setV({ ...v, locationId: e.target.value })} className={input}>
            <option value="">{t("wholeBusiness")}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
      </div>
      {locked && <p className="text-xs text-zinc-500">{t("lockedHint")}</p>}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-green-700 dark:text-green-400">{t("saved")}</span>}
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
        {onDone && (
          <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            {t("cancel")}
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {initial?.id ? t("saveChanges") : t("record")}
        </button>
      </div>
    </form>
  );
}
