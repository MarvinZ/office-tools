"use client";

import { useTranslations } from "next-intl";
import type { ServiceRow } from "@/services/barbers/catalog";

/**
 * One-tap shortcuts for the services actually logged most often at this
 * location recently (resolved server-side by getMostUsedServicesAtLocation).
 *
 * Renders nothing when there are no favorites — a brand-new location has no
 * history to learn from, and showing an arbitrary fallback list under a "most
 * used here" heading would misrepresent it as learned.
 *
 * Styled as pills to match the roster check-in pills directly above it.
 */
export default function FavoriteServiceButtons({
  services,
  onSelect,
}: {
  services: ServiceRow[];
  onSelect: (serviceId: string) => void;
}) {
  const t = useTranslations("barbers");

  if (services.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {t("log.favoritesTitle")}
      </p>
      <div className="flex flex-wrap gap-2">
        {services.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-400 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
