"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { unwrap } from "@/lib/barbers/errors";
import type { RecommendationCategory } from "@/lib/barbers/panel";
import { decideRecommendationAction } from "../actions";

export type RecommendationItem = {
  key: string;
  category: RecommendationCategory;
  message: string; // already translated, with the figures that triggered it
  href: string;
  decision: { status: "attended" | "dismissed"; when: string } | null;
};

const CATEGORY_CLS: Record<RecommendationCategory, string> = {
  alert: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  followUp: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  opportunity: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  info: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

/**
 * Pending recommendations first, decided ones folded away (§9 Historial).
 * "Revisar" only navigates; marking done/dismissed only records the decision.
 */
export default function RecommendationList({ items }: { items: RecommendationItem[] }) {
  const t = useTranslations("barbers.panel.recs");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(key: string, status: "attended" | "dismissed" | null) {
    setError(null);
    startTransition(async () => {
      try {
        await unwrap(decideRecommendationAction(key, status));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const open = items.filter((i) => !i.decision);
  const decided = items.filter((i) => i.decision);

  const row = (i: RecommendationItem) => (
    <li key={i.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-1">
        <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_CLS[i.category]}`}>{t(`category.${i.category}`)}</span>
        <p className="text-sm text-black dark:text-white">{i.message}</p>
        {i.decision && <p className="text-xs text-zinc-400">{t(i.decision.status, { when: i.decision.when })}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          href={i.href}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-black hover:border-zinc-400 dark:border-zinc-700 dark:text-white"
        >
          {t("review")}
        </Link>
        {i.decision ? (
          <button type="button" disabled={pending} onClick={() => decide(i.key, null)} className={ghost}>
            {t("restore")}
          </button>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={() => decide(i.key, "attended")} className={ghost}>
              {t("attend")}
            </button>
            <button type="button" disabled={pending} onClick={() => decide(i.key, "dismissed")} className={ghost}>
              {t("dismiss")}
            </button>
          </>
        )}
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-2">
      {open.length === 0 ? (
        <p className="py-3 text-sm text-zinc-400">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">{open.map(row)}</ul>
      )}
      {decided.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-zinc-500">{t("history", { count: decided.length })}</summary>
          <ul className="divide-y divide-zinc-100 opacity-70 dark:divide-zinc-800">{decided.map(row)}</ul>
        </details>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <p className="text-xs text-zinc-400">{t("note")}</p>
    </div>
  );
}

const ghost =
  "rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800";
