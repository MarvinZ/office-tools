"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createTipAction } from "../actions";
import TipList from "./tip-list";
import type { BarberRow } from "@/services/barbers/barbers";
import type { TipWithBarberName } from "@/services/barbers/tips";
import { todayBusinessDate } from "@/lib/barbers/dates";

export default function TipForm({
  barbers,
  initialTips,
}: {
  barbers: BarberRow[];
  initialTips: TipWithBarberName[];
}) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [tips, setTips] = useState(initialTips);
  const [error, setError] = useState<string | null>(null);

  const [barberId, setBarberId] = useState("");
  const [amount, setAmount] = useState("");
  const [tipDate, setTipDate] = useState(todayBusinessDate());
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!barberId) {
      setError(t("tips.errorMissingBarber"));
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(t("tips.errorInvalidAmount"));
      return;
    }
    if (!tipDate) {
      setError(t("tips.errorMissingDate"));
      return;
    }

    startTransition(async () => {
      try {
        const row = await createTipAction({
          barberId,
          amount: parsedAmount,
          tipDate,
          note: note.trim() || undefined,
        });

        const barber = barbers.find((b) => b.id === row.barberId);
        setTips((prev) => [
          { ...row, barberName: barber ? `${barber.firstName} ${barber.lastName}` : "" },
          ...prev,
        ]);

        setBarberId("");
        setAmount("");
        setTipDate(todayBusinessDate());
        setNote("");
      } catch {
        setError(t("tips.errorSubmitFailed"));
      }
    });
  }

  function handleDeleted(id: string) {
    setTips((prev) => prev.filter((v) => v.id !== id));
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6"
      >
        {barbers.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {t("tips.noBarbers")}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("tips.fieldBarber")} *</label>
            <select
              required
              disabled={barbers.length === 0}
              value={barberId}
              onChange={(e) => setBarberId(e.target.value)}
              className={inputCls}
            >
              <option value="">{t("tips.selectPlaceholder")}</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.firstName} {b.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("tips.fieldAmount")} *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("tips.fieldTipDate")} *</label>
            <input
              type="date"
              required
              value={tipDate}
              onChange={(e) => setTipDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("tips.fieldNote")}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("tips.fieldNotePlaceholder")}
              className={inputCls}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || barbers.length === 0}
            className="w-full rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 sm:w-auto"
          >
            {pending ? tc("saving") : t("tips.submitButton")}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("tips.listTitle")}</h2>
        <TipList tips={tips} barbers={barbers} onDeleted={handleDeleted} />
      </div>
    </div>
  );
}
