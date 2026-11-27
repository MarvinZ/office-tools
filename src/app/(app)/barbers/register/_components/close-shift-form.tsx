"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Decimal from "decimal.js";
import { unwrap } from "@/lib/barbers/errors";
import { fmtColones } from "@/lib/barbers/currency";
import { closeShiftAction } from "../actions";

export type CountLine = { key: string; name: string; kind: string; expected: number };

/**
 * Close the shift: the cashier enters what they count for each payment method
 * (cash in the drawer, the card terminal's closing, SINPE received) and sees
 * the difference before confirming. The server recomputes everything.
 */
export default function CloseShiftForm({ shiftId, lines }: { shiftId: string; lines: CountLine[] }) {
  const t = useTranslations("barbers.register");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const preview = useMemo(() => {
    let expected = new Decimal(0);
    let counted = new Decimal(0);
    for (const l of lines) {
      expected = expected.plus(l.expected);
      const v = Number(counts[l.key]);
      if (Number.isFinite(v)) counted = counted.plus(v);
    }
    return { expected: expected.toNumber(), counted: counted.toNumber(), difference: expected.minus(counted).toNumber() };
  }, [lines, counts]);

  const complete = lines.every((l) => counts[l.key] !== undefined && counts[l.key].trim() !== "" && Number(counts[l.key]) >= 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!complete) {
      setError(t("errorCounts"));
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const counted = Object.fromEntries(lines.map((l) => [l.key, Number(counts[l.key])]));
    startTransition(async () => {
      try {
        await unwrap(closeShiftAction(shiftId, counted, note));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setConfirming(false);
      }
    });
  }

  const diffLabel = (d: number) =>
    d > 0 ? t("missing", { amount: fmtColones(d) }) : d < 0 ? t("extra", { amount: fmtColones(-d) }) : t("balanced");

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {lines.map((l) => {
          const v = Number(counts[l.key]);
          const filled = counts[l.key] !== undefined && counts[l.key].trim() !== "" && Number.isFinite(v);
          const d = filled ? new Decimal(l.expected).minus(v).toNumber() : null;
          return (
            <div key={l.key} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_9rem_10rem_10rem]">
              <span className="text-sm font-medium text-black dark:text-white">
                {l.name}
                <span className="block text-xs font-normal text-zinc-500">{t(`countHint.${l.kind}`)}</span>
              </span>
              <span className="text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                <span className="block text-xs text-zinc-400 sm:hidden">{t("expected")}</span>
                {fmtColones(l.expected)}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                aria-label={t("countedFor", { name: l.name })}
                value={counts[l.key] ?? ""}
                onChange={(e) => {
                  setConfirming(false);
                  setCounts((c) => ({ ...c, [l.key]: e.target.value }));
                }}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-right text-sm tabular-nums text-black outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
              />
              <span className={`text-right text-xs tabular-nums ${d && d > 0 ? "text-red-700 dark:text-red-400" : "text-zinc-500"}`}>
                {d === null ? "" : diffLabel(d)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-1 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-900 sm:grid-cols-3">
        <div><span className="text-xs text-zinc-500">{t("expected")}</span><p className="font-semibold tabular-nums">{fmtColones(preview.expected)}</p></div>
        <div><span className="text-xs text-zinc-500">{t("counted")}</span><p className="font-semibold tabular-nums">{fmtColones(preview.counted)}</p></div>
        <div>
          <span className="text-xs text-zinc-500">{t("difference")}</span>
          <p className={`font-semibold tabular-nums ${preview.difference > 0 ? "text-red-700 dark:text-red-400" : ""}`}>{complete ? diffLabel(preview.difference) : "—"}</p>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {t("note")}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
        />
      </label>

      {confirming && complete && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {preview.difference > 0 ? t("confirmShortfall", { amount: fmtColones(preview.difference) }) : t("confirmClose")}
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {confirming ? t("confirm") : t("close")}
        </button>
      </div>
    </form>
  );
}
