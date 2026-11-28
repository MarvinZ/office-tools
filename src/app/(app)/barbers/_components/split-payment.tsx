"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { fmtColones } from "@/lib/barbers/currency";

export type PaymentRow = { key: string; paymentMethodId: string; amount: string };

/** What's still to assign: total − Σ rows (exact). */
export function remainingOf(total: number, rows: PaymentRow[]): number {
  return rows.reduce((acc, r) => acc.minus(Number(r.amount) || 0), new Decimal(total)).toDecimalPlaces(2).toNumber();
}

/**
 * Split one ticket across several payment methods (NOURA Módulo 1 §5), e.g.
 * part cash, part card. The amounts must add up to the ticket's total; the
 * server checks it again.
 */
export default function SplitPayment({
  total,
  rows,
  onChange,
  methods,
}: {
  total: number;
  rows: PaymentRow[];
  onChange: (rows: PaymentRow[]) => void;
  methods: { id: string; name: string }[];
}) {
  const t = useTranslations("barbers.splitPayment");
  const remaining = remainingOf(total, rows);
  const input =
    "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("title")}</p>
      {rows.map((r, i) => (
        <div key={r.key} className="flex items-center gap-2">
          <select
            aria-label={t("method", { n: i + 1 })}
            value={r.paymentMethodId}
            onChange={(e) => onChange(rows.map((x) => (x.key === r.key ? { ...x, paymentMethodId: e.target.value } : x)))}
            className={`${input} flex-1`}
          >
            {methods.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            aria-label={t("amount", { n: i + 1 })}
            value={r.amount}
            onChange={(e) => onChange(rows.map((x) => (x.key === r.key ? { ...x, amount: e.target.value } : x)))}
            className={`${input} w-32 text-right tabular-nums`}
          />
          <button
            type="button"
            disabled={rows.length <= 2}
            aria-label={t("remove")}
            onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
            className="rounded p-1 text-zinc-400 hover:text-red-600 disabled:opacity-30"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() =>
            onChange([...rows, { key: crypto.randomUUID(), paymentMethodId: methods[0]?.id ?? "", amount: remaining > 0 ? String(remaining) : "" }])
          }
          className="inline-flex items-center gap-1 text-zinc-600 hover:text-black dark:text-zinc-300 dark:hover:text-white"
        >
          <Plus size={12} /> {t("add")}
        </button>
        <span className={`tabular-nums ${remaining === 0 ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
          {remaining === 0 ? t("complete") : remaining > 0 ? t("missing", { amount: fmtColones(remaining) }) : t("over", { amount: fmtColones(-remaining) })}
        </span>
      </div>
    </div>
  );
}
