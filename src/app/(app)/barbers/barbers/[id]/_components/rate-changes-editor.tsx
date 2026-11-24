"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarClock, Trash2 } from "lucide-react";
import { deleteRateChangeAction, recordRateChangeAction } from "../actions";
import type { RateChangeListItem } from "@/services/barbers/rate-changes";
import { fmtDay } from "@/lib/barbers/dates";

const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 10000) / 100}%`);

/**
 * Commission changes with a start date (option B). A change can start in the
 * future, or in the past: services already logged from that date in open
 * fortnights are re-rated; closed fortnights never change.
 */
export default function RateChangesEditor({
  barberId,
  services,
  changes,
  today,
}: {
  barberId: string;
  services: { id: string; name: string }[];
  changes: RateChangeListItem[];
  today: string;
}) {
  const t = useTranslations("barbers.rateChanges");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState("");
  const [rate, setRate] = useState("");
  const [from, setFrom] = useState(today);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const value = rate.trim() === "" ? null : parseFloat(rate);
    if (value != null && (Number.isNaN(value) || value <= 0 || value > 100)) {
      setError(t("errorRate"));
      return;
    }
    startTransition(async () => {
      try {
        const { reRated } = await recordRateChangeAction({
          barberId,
          serviceId: scope || null,
          rate: value != null ? value / 100 : null,
          effectiveFrom: from,
          note,
        });
        setMessage(from > today ? t("scheduled", { date: fmtDay(from) }) : t("applied", { count: reRated }));
        setRate("");
        setNote("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteRateChangeAction(barberId, id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      }
    });
  }

  const input =
    "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";
  const label = "flex flex-col gap-1 text-xs text-zinc-500";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1.4fr_0.7fr_1fr] sm:items-end">
        <label className={label}>
          {t("scope")}
          <select id="rateScope" value={scope} onChange={(e) => setScope(e.target.value)} className={input}>
            <option value="">{t("allServices")}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("newRate")}
          <div className="flex items-center gap-1">
            <input
              id="rateValue"
              type="number"
              min="1"
              max="100"
              step="0.01"
              placeholder={t("noRate")}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className={`${input} w-full`}
            />
            <span className="text-zinc-400">%</span>
          </div>
        </label>
        <label className={label}>
          {t("from")}
          <input id="rateFrom" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          {t("note")}
          <input id="rateNote" value={note} onChange={(e) => setNote(e.target.value)} className={input} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {t("save")}
        </button>
      </form>
      <p className="text-xs text-zinc-400">{t("hint")}</p>
      {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {changes.length > 0 && (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100 text-sm dark:divide-zinc-800 dark:border-zinc-800">
          {changes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="font-medium text-black dark:text-white">{fmtDay(c.effectiveFrom)}</span>
              <span className="text-zinc-600 dark:text-zinc-300">{c.serviceName ?? t("allServices")}</span>
              <span className="tabular-nums text-zinc-500">
                {pct(c.previousRate)} → {c.rate == null ? t("noRate") : pct(c.rate)}
              </span>
              {c.note && <span className="text-xs text-zinc-400">“{c.note}”</span>}
              {c.upcoming && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                  <CalendarClock size={12} /> {t("upcoming")}
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    aria-label={t("delete")}
                    className="ml-1 hover:text-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
