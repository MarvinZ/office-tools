"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { carryOverAction, undoCarryOverAction } from "../actions";
import { fmtColones } from "@/lib/barbers/currency";

/**
 * Admin action on a closed fortnight's shortfall (spec §8.1, §8.5): move all
 * or part of it to the next fortnight, or undo that while the next one is
 * still open.
 */
export default function CarryOverControl({
  period,
  barberId,
  shortfall,
  carried,
  nextClosed,
}: {
  period: string;
  barberId: string;
  shortfall: number;
  carried: number | undefined;
  nextClosed: boolean;
}) {
  const t = useTranslations("barbers.settlements");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorClosing"));
      }
    });
  }

  function carry() {
    const input = window.prompt(t("carryPrompt", { max: fmtColones(shortfall) }), String(shortfall));
    if (input == null) return;
    const amount = Number(input.replace(/[₡\s,]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0 || amount > shortfall) {
      setError(t("carryInvalid"));
      return;
    }
    run(() => carryOverAction(period, barberId, amount));
  }

  const link = "underline hover:text-black disabled:opacity-50 dark:hover:text-white";

  return (
    <span className="mt-0.5 block text-xs font-normal text-zinc-500">
      {carried != null ? (
        <>
          {t("carried", { amount: fmtColones(carried) })}
          {!nextClosed && (
            <>
              {" · "}
              <button className={link} disabled={pending} onClick={() => run(() => undoCarryOverAction(period, barberId))}>
                {t("carryUndo")}
              </button>
            </>
          )}
        </>
      ) : (
        !nextClosed && (
          <button className={link} disabled={pending} onClick={carry}>
            {t("carryForward")}
          </button>
        )
      )}
      {error && <span className="block text-red-600">{error}</span>}
    </span>
  );
}
