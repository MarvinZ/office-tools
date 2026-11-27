"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { BUSINESS_TIME_ZONE } from "@/lib/barbers/dates";
import { COSTA_RICA_OFFSET_MINUTES, greetingFor } from "@/lib/barbers/panel";

/**
 * Greeting, live Costa Rica date and time, the location filter and the time
 * zone warning (Módulo 1 §3). Everything is shown in Costa Rica time whatever
 * the device says; a device in another zone only gets a warning (CA 08).
 */
export default function PanelHeader({
  name,
  initialNow,
  locations,
  locationId,
}: {
  name: string;
  initialNow: string; // ISO, from the server, so the first render matches
  locations: { id: string; name: string }[];
  locationId: string | null;
}) {
  const t = useTranslations("barbers.panel");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [now, setNow] = useState(() => new Date(initialNow));
  const [deviceZone, setDeviceZone] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    // Read the device's zone after mounting (the server has no device).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    if (new Date().getTimezoneOffset() !== COSTA_RICA_OFFSET_MINUTES) {
      setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "?");
    }
    return () => clearInterval(id);
  }, []);

  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: BUSINESS_TIME_ZONE }).format(now)
  );
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(now);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: BUSINESS_TIME_ZONE }).format(now);

  function selectLocation(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("locationId");
    else params.set("locationId", value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm text-zinc-500">NOURA · {t("title")}</p>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t(`greeting.${greetingFor(hour)}`, { name })}</h1>
          {/* Server and browser Intl data can format the same instant slightly differently. */}
          <p suppressHydrationWarning className="mt-1 text-sm capitalize text-zinc-500">
            {date} · <span className="tabular-nums">{time}</span>
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {t("locationLabel")}
          <select
            value={locationId ?? "all"}
            onChange={(e) => selectLocation(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
          >
            <option value="all">{t("allLocations")}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {deviceZone && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {t("tzWarning", { zone: deviceZone })}
        </p>
      )}
    </div>
  );
}
