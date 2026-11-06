"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { logWarrantyRedoAction, setActivityStatusAction } from "../actions";
import type { ActivityListItem } from "@/services/barbers/activities";

type Mode = "menu" | "void" | "warranty";

/**
 * Per-service actions (spec §8.7, §8.8, §8.10): courtesy, warranty redo and
 * void. Voiding and redos ask for details inline; nothing is ever deleted.
 */
export default function ActivityRowActions({
  activity,
  barbers,
}: {
  activity: Pick<ActivityListItem, "id" | "barberId" | "status">;
  barbers: { id: string; name: string }[];
}) {
  const t = useTranslations("barbers.activityStatus");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [reason, setReason] = useState("");
  const [corrector, setCorrector] = useState(activity.barberId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  // Fixed-position popover: the lists sit in horizontally scrolling containers
  // that would clip an absolutely positioned one.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function close() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const width = 256;
    // Open upward when there isn't room below.
    const top = window.innerHeight - r.bottom < 280 ? Math.max(8, r.top - 280) : r.bottom + 4;
    setPos({ top, left: Math.max(8, r.right - width) });
    setOpen((o) => !o);
    setMode("menu");
    setReason("");
    setError(null);
    setCorrector(activity.barberId);
  }

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorGeneric"));
      }
    });
  }

  const item = "block w-full rounded-md px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800";
  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-black outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";
  const primary = "rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200";
  const secondary = "rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-black dark:hover:text-white";

  const { status } = activity;
  const canRedo = status === "active" || status === "courtesy";

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={toggle}
        aria-label={t("actions")}
        aria-expanded={open}
        className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-black dark:hover:bg-zinc-800 dark:hover:text-white"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && pos && (
        <div
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-64 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {mode === "menu" && (
            <>
              {status === "active" && (
                <button className={item} disabled={pending} onClick={() => run(() => setActivityStatusAction(activity.id, "courtesy"))}>
                  {t("markCourtesy")}
                </button>
              )}
              {status === "courtesy" && (
                <button className={item} disabled={pending} onClick={() => run(() => setActivityStatusAction(activity.id, "active"))}>
                  {t("markNormal")}
                </button>
              )}
              {canRedo && (
                <button className={item} disabled={pending} onClick={() => setMode("warranty")}>
                  {t("warrantyRedo")}
                </button>
              )}
              {status === "voided" ? (
                <button className={item} disabled={pending} onClick={() => run(() => setActivityStatusAction(activity.id, "active"))}>
                  {t("restore")}
                </button>
              ) : (
                <button className={`${item} text-red-600 dark:text-red-400`} disabled={pending} onClick={() => setMode("void")}>
                  {t("void")}
                </button>
              )}
            </>
          )}

          {mode === "void" && (
            <div className="flex flex-col gap-2 p-1.5">
              <label className="flex flex-col gap-1 text-xs text-zinc-500">
                {t("voidReason")}
                <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
              </label>
              <div className="flex justify-end gap-1">
                <button className={secondary} onClick={() => setMode("menu")}>{tc("cancel")}</button>
                <button
                  className={primary}
                  disabled={pending || !reason.trim()}
                  onClick={() => run(() => setActivityStatusAction(activity.id, "voided", reason))}
                >
                  {t("voidConfirm")}
                </button>
              </div>
            </div>
          )}

          {mode === "warranty" && (
            <div className="flex flex-col gap-2 p-1.5">
              <label className="flex flex-col gap-1 text-xs text-zinc-500">
                {t("redoneBy")}
                <select value={corrector} onChange={(e) => setCorrector(e.target.value)} className={inputCls}>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.id === activity.barberId ? ` (${t("sameBarber")})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-zinc-400">{t(corrector === activity.barberId ? "redoSameHint" : "redoOtherHint")}</p>
              <label className="flex flex-col gap-1 text-xs text-zinc-500">
                {t("redoReason")}
                <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
              </label>
              <div className="flex justify-end gap-1">
                <button className={secondary} onClick={() => setMode("menu")}>{tc("cancel")}</button>
                <button
                  className={primary}
                  disabled={pending}
                  onClick={() => run(() => logWarrantyRedoAction(activity.id, corrector, reason))}
                >
                  {t("redoConfirm")}
                </button>
              </div>
            </div>
          )}

          {error && <p className="px-3 pb-1.5 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

const BADGE: Record<string, string> = {
  voided: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  courtesy: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  warranty: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

/** Small status pill; renders nothing for a normal service. */
export function ActivityStatusBadge({ status, reason }: { status: string; reason?: string | null }) {
  const t = useTranslations("barbers.activityStatus");
  if (status === "active") return null;
  return (
    <span title={reason ?? undefined} className={`ml-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[status] ?? ""}`}>
      {t(`status.${status}`)}
    </span>
  );
}
