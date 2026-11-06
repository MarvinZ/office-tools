"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateBarberPaymentDetailsAction } from "../actions";

/**
 * Cédula and IBAN (for the bank transfer list) plus the other spellings of the
 * barber's name used in the daily closing file. Aliases are edited as one
 * comma-separated field — a handful per barber at most.
 */
export default function BarberPaymentEditor({
  barberId,
  initial,
}: {
  barberId: string;
  initial: { idNumber: string | null; iban: string | null; aliases: string[] };
}) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [idNumber, setIdNumber] = useState(initial.idNumber ?? "");
  const [iban, setIban] = useState(initial.iban ?? "");
  const [aliases, setAliases] = useState(initial.aliases.join(", "));

  function change(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setDirty(true);
    };
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateBarberPaymentDetailsAction(barberId, {
          idNumber,
          iban,
          aliases: aliases.split(","),
        });
        setDirty(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("paymentDetails.errorSaveFailed"));
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";
  const labelCls = "flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          {t("paymentDetails.idNumber")}
          <input value={idNumber} onChange={change(setIdNumber)} className={inputCls} autoComplete="off" />
        </label>
        <label className={labelCls}>
          {t("paymentDetails.iban")}
          <input
            value={iban}
            onChange={change(setIban)}
            placeholder="CR05 0152 0200 1026 2840 66"
            className={`${inputCls} font-mono`}
            autoComplete="off"
          />
        </label>
      </div>
      <label className={labelCls}>
        {t("paymentDetails.aliases")}
        <input value={aliases} onChange={change(setAliases)} placeholder="Bryan, Brayan M." className={inputCls} />
        <span className="text-xs text-zinc-400">{t("paymentDetails.aliasesHint")}</span>
      </label>

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
