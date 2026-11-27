"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { GoalsInput, PanelConfig } from "@/services/barbers/panel";
import { unwrap } from "@/lib/barbers/errors";
import { updatePanelGoalsAction } from "../actions";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // shown Monday first

/** Monthly and daily goals per location, plus the days the shop is closed (§8). */
export default function GoalsEditor({ config, canEdit }: { config: PanelConfig; canEdit: boolean }) {
  const t = useTranslations("barbers.panel.goals");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [closed, setClosed] = useState<number[]>(config.closedWeekdays);
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      config.locations.map((l) => [l.id, { monthly: l.monthlyGoal?.toString() ?? "", daily: l.dailyGoal?.toString() ?? "" }])
    )
  );

  function parse(v: string): number | null | "invalid" {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : "invalid";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const goals: GoalsInput["goals"] = [];
    for (const l of config.locations) {
      const monthlyGoal = parse(drafts[l.id].monthly);
      const dailyGoal = parse(drafts[l.id].daily);
      if (monthlyGoal === "invalid" || dailyGoal === "invalid") {
        setError(t("invalid"));
        return;
      }
      goals.push({ locationId: l.id, monthlyGoal, dailyGoal });
    }
    startTransition(async () => {
      try {
        await unwrap(updatePanelGoalsAction({ closedWeekdays: closed, goals }));
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";

  return (
    <details id="goals" className="group rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-black marker:hidden dark:text-white sm:px-6">
        {t("title")}
        <span className="ml-2 font-normal text-zinc-400">{t("subtitle")}</span>
      </summary>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 border-t border-zinc-200 p-4 dark:border-zinc-800 sm:p-6">
        {config.locations.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("noLocations")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {config.locations.map((l) => (
              <div key={l.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_12rem_12rem] sm:items-end sm:gap-3">
                <p className="text-sm font-medium text-black dark:text-white">{l.name}</p>
                <label className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t("monthly")}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    disabled={!canEdit}
                    value={drafts[l.id].monthly}
                    onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: { ...d[l.id], monthly: e.target.value } }))}
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <label className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t("daily")}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    disabled={!canEdit}
                    value={drafts[l.id].daily}
                    onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: { ...d[l.id], daily: e.target.value } }))}
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
              </div>
            ))}
          </div>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("closedDays")}</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = closed.includes(d);
              return (
                <label
                  key={d}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
                    on
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    disabled={!canEdit}
                    checked={on}
                    onChange={() => setClosed((c) => (on ? c.filter((x) => x !== d) : [...c, d]))}
                  />
                  {t(`weekday.${d}`)}
                </label>
              );
            })}
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {saved && <p className="text-sm text-green-600 dark:text-green-400">{t("saved")}</p>}

        {canEdit && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 sm:w-auto"
            >
              {t("save")}
            </button>
          </div>
        )}
      </form>
    </details>
  );
}
