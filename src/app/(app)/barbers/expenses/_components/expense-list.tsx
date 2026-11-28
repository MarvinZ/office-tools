"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { unwrap } from "@/lib/barbers/errors";
import { fmtColones } from "@/lib/barbers/currency";
import { fmtDay } from "@/lib/barbers/dates";
import type { ExpenseStatus } from "@/lib/barbers/expenses";
import { deleteExpenseAction, reviewExpenseAction } from "../actions";
import ExpenseForm from "./expense-form";

export type ExpenseItem = {
  id: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  paidWith: string;
  status: ExpenseStatus;
  locationId: string | null;
  locationName: string | null;
  fromRegister: boolean;
  rejectReason: string | null;
};

const STATUS_CLS: Record<ExpenseStatus, string> = {
  approved: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  rejected: "bg-zinc-100 text-zinc-600 line-through dark:bg-zinc-800 dark:text-zinc-400",
};

/** The period's expenses; admins approve, reject, edit or delete them in place. */
export default function ExpenseList({
  items,
  canManage,
  locations,
  today,
}: {
  items: ExpenseItem[];
  canManage: boolean;
  locations: { id: string; name: string }[];
  today: string;
}) {
  const t = useTranslations("barbers.expenses");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (items.length === 0) return <p className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">{t("empty")}</p>;

  const btn = "rounded-lg px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800";

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {items.map((e) => (
          <li key={e.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
              <span className="w-24 shrink-0 text-sm tabular-nums text-zinc-500">{fmtDay(e.expenseDate)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-black dark:text-white">{e.description}</p>
                <p className="text-xs text-zinc-500">
                  {t(`categories.${e.category}`)} · {t(`paidWith.${e.paidWith}`)} · {e.locationName ?? t("wholeBusiness")}
                  {e.fromRegister && <> · {t("fromRegister")}</>}
                </p>
                {e.status === "rejected" && e.rejectReason && <p className="text-xs text-zinc-500">{t("rejectedBecause", { reason: e.rejectReason })}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[e.status]}`}>{t(`status.${e.status}`)}</span>
              <span className="w-32 text-right text-sm font-medium tabular-nums text-black dark:text-white">{fmtColones(e.amount)}</span>
            </div>
            {canManage && (
              <div className="flex flex-wrap justify-end gap-1">
                {e.status !== "approved" && (
                  <button type="button" disabled={pending} className={btn} onClick={() => run(() => unwrap(reviewExpenseAction(e.id, "approved")))}>
                    {t("approve")}
                  </button>
                )}
                {e.status !== "rejected" && (
                  <button type="button" disabled={pending} className={btn} onClick={() => { setRejecting(rejecting === e.id ? null : e.id); setReason(""); }}>
                    {t("reject")}
                  </button>
                )}
                {e.status !== "pending" && (
                  <button type="button" disabled={pending} className={btn} onClick={() => run(() => unwrap(reviewExpenseAction(e.id, "pending")))}>
                    {t("backToPending")}
                  </button>
                )}
                <button type="button" disabled={pending} className={btn} onClick={() => setEditing(editing === e.id ? null : e.id)}>
                  {t("edit")}
                </button>
                {!e.fromRegister && (
                  <button
                    type="button"
                    disabled={pending}
                    className={`${btn} hover:text-red-600`}
                    onClick={() => {
                      if (window.confirm(t("confirmDelete"))) run(() => unwrap(deleteExpenseAction(e.id)));
                    }}
                  >
                    {t("delete")}
                  </button>
                )}
              </div>
            )}
            {rejecting === e.id && (
              <form
                className="flex flex-wrap justify-end gap-2"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  run(() => unwrap(reviewExpenseAction(e.id, "rejected", reason)), () => setRejecting(null));
                }}
              >
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={t("rejectReason")}
                  aria-label={t("rejectReason")}
                  value={reason}
                  onChange={(ev) => setReason(ev.target.value)}
                  className="min-w-60 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
                <button type="submit" disabled={pending} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">
                  {t("confirmReject")}
                </button>
              </form>
            )}
            {editing === e.id && (
              <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
                <ExpenseForm
                  locations={locations}
                  today={today}
                  initial={{
                    id: e.id,
                    fromRegister: e.fromRegister,
                    locationId: e.locationId,
                    expenseDate: e.expenseDate,
                    category: e.category,
                    description: e.description,
                    amount: e.amount,
                    paidWith: e.paidWith,
                  }}
                  onDone={() => setEditing(null)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
