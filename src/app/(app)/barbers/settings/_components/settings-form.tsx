"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateBarberSettingsAction } from "../actions";
import type { BarberSettings } from "@/services/barbers/settings";

/** IVA is edited as a percentage (13) and stored as a decimal (0.13). */
export default function SettingsForm({ initial }: { initial: BarberSettings }) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [ivaPct, setIvaPct] = useState(String(Math.round(initial.ivaRate * 10000) / 100));
  const [fee, setFee] = useState(String(initial.maintenanceDailyFee));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const pct = parseFloat(ivaPct);
    const amount = parseFloat(fee);
    if (Number.isNaN(pct) || pct < 0 || pct >= 100) {
      setError(t("settingsPage.errorIva"));
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      setError(t("settingsPage.errorFee"));
      return;
    }
    startTransition(async () => {
      try {
        await updateBarberSettingsAction({ ivaRate: pct / 100, maintenanceDailyFee: amount });
        setSaved(true);
        router.refresh();
      } catch {
        setError(t("settingsPage.errorSaveFailed"));
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const labelCls = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6"
    >
      <div>
        <label className={labelCls}>{t("settingsPage.fieldIva")} (%)</label>
        <input type="number" min="0" max="99" step="0.01" required value={ivaPct} onChange={(e) => setIvaPct(e.target.value)} className={inputCls} />
        <p className="mt-1 text-xs text-zinc-400">{t("settingsPage.fieldIvaHint")}</p>
      </div>
      <div>
        <label className={labelCls}>{t("settingsPage.fieldMaintenanceFee")} (₡)</label>
        <input type="number" min="0" step="0.01" required value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} />
        <p className="mt-1 text-xs text-zinc-400">{t("settingsPage.fieldMaintenanceFeeHint")}</p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-600 dark:text-green-400">{t("settingsPage.saved")}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 sm:w-auto"
        >
          {pending ? tc("saving") : tc("saveChanges")}
        </button>
      </div>
    </form>
  );
}
