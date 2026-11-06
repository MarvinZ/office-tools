"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";

export default function PrintButton() {
  const t = useTranslations("barbers.settlementDoc");
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
    >
      <Printer size={14} />
      {t("print")}
    </button>
  );
}
