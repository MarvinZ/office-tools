"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { checkInBarberAction, checkOutBarberAction } from "../actions";
import type { BarberRow } from "@/services/barbers/barbers";

/**
 * "Who's working today?" — editable all day. Checking a barber in makes them
 * available in the entry form's picker below; unchecking removes them. This
 * is a live roster, not an attendance log — no lock, no history kept.
 */
export default function RosterChecklist({
  locationId,
  workDate,
  barbersAtLocation,
  checkedInIds,
}: {
  locationId: string;
  workDate: string;
  barbersAtLocation: BarberRow[];
  checkedInIds: string[];
}) {
  const t = useTranslations("barbers");
  const [pending, startTransition] = useTransition();
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set(checkedInIds));

  function toggle(barberId: string) {
    const willCheckIn = !checkedIn.has(barberId);
    const next = new Set(checkedIn);
    if (willCheckIn) next.add(barberId);
    else next.delete(barberId);
    setCheckedIn(next);

    startTransition(async () => {
      if (willCheckIn) {
        await checkInBarberAction(locationId, barberId, workDate);
      } else {
        await checkOutBarberAction(locationId, barberId, workDate);
      }
    });
  }

  if (barbersAtLocation.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        {t("log.noBarbersAtLocation")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("log.rosterTitle")}</h2>
      <div className="flex flex-wrap gap-2">
        {barbersAtLocation.map((b) => {
          const isIn = checkedIn.has(b.id);
          return (
            <button
              key={b.id}
              type="button"
              disabled={pending}
              onClick={() => toggle(b.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                isIn
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
              }`}
            >
              {isIn ? "✓ " : ""}{b.firstName} {b.lastName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
