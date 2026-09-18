"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import type { PaymentMethodRow } from "@/services/barbers/payment-methods";
import { updatePaymentMethodAction } from "../actions";

export default function EditPaymentMethodModal({ paymentMethod }: { paymentMethod: PaymentMethodRow }) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(paymentMethod.name);
  const [feeRate, setFeeRate] = useState(paymentMethod.feeRate);
  const [status, setStatus] = useState<"active" | "inactive">(paymentMethod.status);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rate = parseFloat(feeRate);
    if (Number.isNaN(rate)) return;
    startTransition(async () => {
      await updatePaymentMethodAction(paymentMethod.id, {
        name,
        feeRate: rate,
        status,
      });
      router.refresh();
      setOpen(false);
    });
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-black dark:hover:text-white">
        <Pencil size={12} />
        {tc("edit")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-black dark:text-white">{t("paymentMethodForm.editTitle")}</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-black dark:hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
              <div>
                <label className={labelCls}>{t("paymentMethodForm.fieldName")} *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("paymentMethodForm.fieldNamePlaceholder")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("paymentMethodForm.fieldFeeRate")} *</label>
                <input required type="number" min="0" max="1" step="0.0001" value={feeRate} onChange={(e) => setFeeRate(e.target.value)} className={inputCls} />
                <p className="mt-1 text-xs text-zinc-400">{t("paymentMethodForm.feeRateHint")}</p>
              </div>
              <div>
                <label className={labelCls}>{t("paymentMethodForm.fieldStatus")}</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")} className={inputCls}>
                  <option value="active">{t("status.active")}</option>
                  <option value="inactive">{t("status.inactive")}</option>
                </select>
              </div>
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                {t("paymentMethodForm.historyNote")}
              </p>
              <div className="flex justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400">
                  {tc("cancel")}
                </button>
                <button type="submit" disabled={pending} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                  {pending ? tc("saving") : tc("saveChanges")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
