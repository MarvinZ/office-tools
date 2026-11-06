"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock, LockOpen } from "lucide-react";
import { closeFortnightAction, reopenFortnightAction } from "../actions";

/** Close (freeze) or reopen the fortnight. Rendered only for org admins. */
export default function ClosingControls({ period, closed }: { period: string; closed: boolean }) {
  const t = useTranslations("barbers.settlements");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    // Reopening needs a reason (spec §11.1); closing just a confirmation.
    let reason = "";
    if (closed) {
      reason = window.prompt(t("reopenReasonPrompt"))?.trim() ?? "";
      if (!reason) return;
    } else if (!window.confirm(t("confirmClose"))) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await (closed ? reopenFortnightAction(period, reason) : closeFortnightAction(period));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorClosing"));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={pending}
        className={
          closed
            ? "inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:text-black disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
            : "inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        }
      >
        {closed ? <LockOpen size={14} /> : <Lock size={14} />}
        {pending ? t("working") : t(closed ? "reopen" : "close")}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
