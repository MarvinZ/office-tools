"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { LocationRow } from "@/services/barbers/locations";

const STORAGE_KEY = "barbers.selectedLocationId";

/**
 * Front desk works at one physical location — asking them to pick it on every
 * activity entry is pure friction. The choice is remembered per browser via
 * localStorage and mirrored into the URL (?locationId=...) so the server
 * component can read it. A visible "change location" control stays available
 * for the rare case of switching devices/locations.
 */
export default function LocationGate({
  locations,
  current,
  compact,
}: {
  locations: LocationRow[];
  current?: LocationRow | null;
  compact?: boolean;
}) {
  const t = useTranslations("barbers");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const checkedStorage = useRef(false);

  // On first load with no location resolved yet, check localStorage for a
  // remembered choice and redirect into it automatically.
  useEffect(() => {
    if (current || checkedStorage.current) return;
    checkedStorage.current = true;
    try {
      const remembered = localStorage.getItem(STORAGE_KEY);
      if (remembered && locations.some((l) => l.id === remembered)) {
        router.replace(`${pathname}?locationId=${remembered}`);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back to manual selection.
    }
  }, [current, checkedStorage, locations, pathname, router]);

  function selectLocation(locationId: string) {
    try {
      localStorage.setItem(STORAGE_KEY, locationId);
    } catch {
      // Best-effort only; the URL param still works for this navigation.
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("locationId", locationId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function changeLocation() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore — the URL param removal below still takes effect.
    }
    router.push(pathname);
  }

  if (current) {
    if (!compact) return null;
    return (
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-medium text-black dark:text-white">{current.name}</span>
        <button
          onClick={changeLocation}
          className="text-xs text-zinc-500 underline decoration-dotted hover:text-black dark:hover:text-white"
        >
          {t("log.changeLocation")}
        </button>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        {t("log.noLocationsYet")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("log.fieldLocation")}</label>
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) selectLocation(e.target.value);
        }}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
      >
        <option value="" disabled>{t("log.selectPlaceholder")}</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </div>
  );
}
