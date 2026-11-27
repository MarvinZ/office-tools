"use client";

import { useTranslations } from "next-intl";

/** Loading failed (Módulo 1 §13): say so and offer a retry; never show partial figures. */
export default function PanelError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("barbers.panel.error");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 px-4 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-white">{t("title")}</h1>
      <p className="text-sm text-zinc-500">{t("body")}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {t("retry")}
      </button>
    </div>
  );
}
