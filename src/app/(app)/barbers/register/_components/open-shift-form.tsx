"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { unwrap } from "@/lib/barbers/errors";
import { openShiftAction } from "../actions";

/** Open the register: the cash float counted into the drawer. */
export default function OpenShiftForm({ locationId, nextShift }: { locationId: string; nextShift: number }) {
  const t = useTranslations("barbers.register");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = amount.trim() === "" ? 0 : Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      setError(t("errorAmount"));
      return;
    }
    startTransition(async () => {
      try {
        await unwrap(openShiftAction(locationId, value));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {t("openingCash")}
        <input
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-48 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm tabular-nums text-black outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {t("open", { n: nextShift })}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
