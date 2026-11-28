"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { unwrap } from "@/lib/barbers/errors";
import { fmtColones } from "@/lib/barbers/currency";
import { addOutflowAction, deleteOutflowAction } from "../actions";

type Outflow = { id: string; amount: number; concept: string; barberName: string | null; kind: "expense" | "vale" | "commission" };

/**
 * Cash taken out of the drawer during the shift ("salidas de efectivo").
 * Choosing a professional also records it as their vale.
 */
export default function Outflows({
  shiftId,
  outflows,
  barbers,
  canEdit,
}: {
  shiftId: string;
  outflows: Outflow[];
  barbers: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const t = useTranslations("barbers.register");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [barberId, setBarberId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !concept.trim()) {
      setError(t("errorOutflow"));
      return;
    }
    run(
      () => unwrap(addOutflowAction(shiftId, { amount: value, concept, barberId: barberId || null })),
      () => {
        setAmount("");
        setConcept("");
        setBarberId("");
      }
    );
  }

  const input =
    "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";

  return (
    <div className="flex flex-col gap-3">
      {outflows.length === 0 ? (
        <p className="text-sm text-zinc-400">{t("noOutflows")}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {outflows.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-black dark:text-white">
                {o.kind === "commission" ? t("commissionOutflow") : o.concept}
                {o.barberName && (
                  <span className="ml-2 text-xs text-zinc-500">
                    {o.kind === "commission" ? o.barberName : t("valeFor", { name: o.barberName })}
                  </span>
                )}
                {o.kind === "expense" && <span className="ml-2 text-xs text-zinc-500">{t("toExpenses")}</span>}
              </span>
              <span className="tabular-nums">{fmtColones(o.amount)}</span>
              {canEdit && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => unwrap(deleteOutflowAction(shiftId, o.id)))}
                  aria-label={t("deleteOutflow")}
                  className="rounded p-1 text-zinc-400 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-[8rem_1fr_12rem_auto]">
          <input type="number" min="0" step="1" inputMode="decimal" placeholder={t("amount")} aria-label={t("amount")} value={amount} onChange={(e) => setAmount(e.target.value)} className={`${input} tabular-nums`} />
          <input type="text" placeholder={t("concept")} aria-label={t("concept")} value={concept} onChange={(e) => setConcept(e.target.value)} className={input} />
          <select aria-label={t("outflowBarber")} value={barberId} onChange={(e) => setBarberId(e.target.value)} className={input}>
            <option value="">{t("notAVale")}</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>{t("valeFor", { name: b.name })}</option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-black hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-white">
            {t("addOutflow")}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
