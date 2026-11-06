"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateBarberSettlementProfileAction } from "../actions";

/**
 * How this barber is paid at settlement time. Each field maps 1:1 to an input
 * of the settlement engine (lib/barbers/settlement.ts). The IVA base is edited
 * as a percentage (0–100) and stored as a decimal (0–1).
 */
export default function BarberSettlementEditor({
  barberId,
  initial,
}: {
  barberId: string;
  initial: {
    appliesMaintenance: boolean;
    ivaBaseRate: string;
    ivaInformative: boolean;
    fortnightlyAddition: string;
    shortfallToSalary: boolean;
  };
}) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [appliesMaintenance, setAppliesMaintenance] = useState(initial.appliesMaintenance);
  const [ivaBasePct, setIvaBasePct] = useState(String(Math.round(parseFloat(initial.ivaBaseRate) * 10000) / 100));
  const [ivaInformative, setIvaInformative] = useState(initial.ivaInformative);
  const [addition, setAddition] = useState(String(parseFloat(initial.fortnightlyAddition)));
  const [shortfallToSalary, setShortfallToSalary] = useState(initial.shortfallToSalary);

  function change<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  function handleSave() {
    setError(null);
    const pct = parseFloat(ivaBasePct);
    const amount = parseFloat(addition || "0");
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setError(t("settlementProfile.errorIvaBase"));
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      setError(t("settlementProfile.errorAddition"));
      return;
    }
    startTransition(async () => {
      try {
        await updateBarberSettlementProfileAction(barberId, {
          appliesMaintenance,
          ivaBaseRate: pct / 100,
          ivaInformative,
          fortnightlyAddition: amount,
          shortfallToSalary,
        });
        setDirty(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("settlementProfile.errorSaveFailed"));
      }
    });
  }

  const inputCls =
    "w-32 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={appliesMaintenance}
          onChange={(e) => change(setAppliesMaintenance)(e.target.checked)}
          className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
        />
        <span>
          {t("settlementProfile.appliesMaintenance")}
          <span className="block text-xs text-zinc-400">{t("settlementProfile.appliesMaintenanceHint")}</span>
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={ivaInformative}
          onChange={(e) => change(setIvaInformative)(e.target.checked)}
          className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
        />
        <span>
          {t("settlementProfile.ivaInformative")}
          <span className="block text-xs text-zinc-400">{t("settlementProfile.ivaInformativeHint")}</span>
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={shortfallToSalary}
          onChange={(e) => change(setShortfallToSalary)(e.target.checked)}
          className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
        />
        <span>
          {t("settlementProfile.shortfallToSalary")}
          <span className="block text-xs text-zinc-400">{t("settlementProfile.shortfallToSalaryHint")}</span>
        </span>
      </label>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          {t("settlementProfile.ivaBase")}
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={ivaBasePct}
              onChange={(e) => change(setIvaBasePct)(e.target.value)}
              className={inputCls}
            />
            <span className="text-zinc-400">%</span>
          </div>
          <span className="text-xs text-zinc-400">{t("settlementProfile.ivaBaseHint")}</span>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          {t("settlementProfile.fortnightlyAddition")}
          <div className="flex items-center gap-1">
            <span className="text-zinc-400">₡</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={addition}
              onChange={(e) => change(setAddition)(e.target.value)}
              className={inputCls}
            />
          </div>
          <span className="text-xs text-zinc-400">{t("settlementProfile.fortnightlyAdditionHint")}</span>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {dirty && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={pending}
            className="rounded-lg bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {pending ? tc("saving") : tc("saveChanges")}
          </button>
        </div>
      )}
    </div>
  );
}
