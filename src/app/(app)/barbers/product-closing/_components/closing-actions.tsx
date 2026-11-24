"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2, Undo2 } from "lucide-react";
import { deleteCustomerSaleAction, markCommissionsPaidAction, unmarkCommissionPaidAction } from "../actions";
import { unwrap } from "@/lib/barbers/errors";

/** "Mark paid" for one collaborator's pending commissions in the period. */
export function MarkPaidControl({
  barberId,
  from,
  to,
  today,
}: {
  barberId: string;
  from: string;
  to: string;
  today: string;
}) {
  const t = useTranslations("barbers.productClosing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [paidAt, setPaidAt] = useState(today);
  const [asCashOutflow, setAsCashOutflow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        await unwrap(markCommissionsPaidAction({ barberId, from, to, paidAt, asCashOutflow }));
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorGeneric"));
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-zinc-600 underline hover:text-black dark:text-zinc-300 dark:hover:text-white">
        {t("markPaid")}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
      <input
        type="date"
        aria-label={t("paidOn")}
        value={paidAt}
        onChange={(e) => setPaidAt(e.target.value)}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={asCashOutflow} onChange={(e) => setAsCashOutflow(e.target.checked)} />
        {t("asCashOutflow")}
      </label>
      <button onClick={confirm} disabled={pending} className="rounded-md bg-black px-2.5 py-1 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black">
        {t("confirmPaid")}
      </button>
      <button onClick={() => setOpen(false)} className="text-zinc-500">{t("cancel")}</button>
      {error && <span className="w-full text-right text-red-600">{error}</span>}
    </div>
  );
}

/** Per-sale actions: delete (while unpaid) or undo a payment. */
export function SaleRowActions({ saleId, paid }: { saleId: string; paid: boolean }) {
  const t = useTranslations("barbers.productClosing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorGeneric"));
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      {paid ? (
        <button
          onClick={() => run(() => unwrap(unmarkCommissionPaidAction(saleId)))}
          disabled={pending}
          title={t("undoPaid")}
          aria-label={t("undoPaid")}
          className="text-zinc-400 hover:text-black dark:hover:text-white"
        >
          <Undo2 size={14} />
        </button>
      ) : (
        <button
          onClick={() => run(() => unwrap(deleteCustomerSaleAction(saleId)))}
          disabled={pending}
          title={t("deleteSale")}
          aria-label={t("deleteSale")}
          className="text-zinc-400 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
