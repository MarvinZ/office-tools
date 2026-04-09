"use client";

import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";

const locales = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
];

export default function LocaleSwitcher({ current }: { current: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      {locales.map((l, i) => (
        <span key={l.code} className="flex items-center gap-1">
          {i > 0 && <span className="text-zinc-300 dark:text-zinc-700">·</span>}
          <button
            disabled={isPending || current === l.code}
            onClick={() => startTransition(() => setLocale(l.code))}
            className={`text-sm transition-colors ${
              current === l.code
                ? "font-semibold text-black dark:text-white"
                : "text-zinc-400 hover:text-black dark:hover:text-white"
            }`}
          >
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
}
