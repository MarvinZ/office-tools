"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { LocationRow } from "@/services/barbers/locations";
import { setBarberLocationsAction } from "../actions";

export default function BarberLocationsEditor({
  barberId,
  allLocations,
  assignedLocationIds,
}: {
  barberId: string;
  allLocations: LocationRow[];
  assignedLocationIds: string[];
}) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(assignedLocationIds);
  const [dirty, setDirty] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
    setDirty(true);
  }

  function handleSave() {
    startTransition(async () => {
      await setBarberLocationsAction(barberId, selected);
      router.refresh();
      setDirty(false);
    });
  }

  if (allLocations.length === 0) {
    return <p className="text-sm text-zinc-400">{t("barberDetail.noLocationsAvailable")}</p>;
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-2">
        {allLocations.map((l) => (
          <label key={l.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={selected.includes(l.id)}
              onChange={() => toggle(l.id)}
              className="rounded border-zinc-300 dark:border-zinc-600"
            />
            {l.name}
            {l.status === "inactive" && <span className="text-xs text-zinc-400">({t("status.inactive")})</span>}
          </label>
        ))}
      </div>
      {dirty && (
        <div className="mt-4 flex justify-end">
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
