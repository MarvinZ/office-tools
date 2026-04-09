"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PayrollRow } from "@/lib/payroll/parser";
import { sendPayrollBatch } from "../actions";
import { DEV_EMAIL_OVERRIDE } from "@/lib/constants";

const fmt = (n: number) => (n === 0 ? "—" : `₡${n.toLocaleString("es-CR")}`);

type Props = {
  batchId: string;
  filename: string;
  rows: PayrollRow[];
  isDuplicate: boolean;
};

export default function BatchReview({ batchId, filename, rows, isDuplicate }: Props) {
  const t = useTranslations("payroll.review");
  const tq = useTranslations("payroll.queued");
  const [status, setStatus] = useState<"idle" | "queuing" | "queued">("idle");
  const [queued, setQueued] = useState(0);
  const [error, setError] = useState("");

  async function handleSend() {
    setStatus("queuing");
    setError("");

    const res = await sendPayrollBatch(batchId);

    if ("error" in res) {
      setError(res.error);
      setStatus("idle");
      return;
    }

    setQueued(res.queued);
    setStatus("queued");
  }

  if (status === "queued") {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950">
          <p className="text-base font-semibold text-green-700 dark:text-green-400">
            {tq("title", { count: queued })}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{tq("subtitle")}</p>
        </div>
        <div className="flex gap-4">
          <a href="/payroll/history" className="text-sm text-black underline dark:text-white">
            {tq("viewHistory")}
          </a>
          <a href="/payroll" className="text-sm text-zinc-500 hover:text-black dark:hover:text-white">
            {tq("processAnother")}
          </a>
        </div>
      </div>
    );
  }

  const cols = [
    t("columns.empleado"),
    t("columns.cedula"),
    t("columns.puesto"),
    t("columns.salario"),
    t("columns.totalBruto"),
    t("columns.ccss"),
    t("columns.bcoPop"),
    t("columns.embargos"),
    t("columns.netoAPagar"),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-black dark:text-white">{filename}</p>
          <p className="mt-0.5 text-sm text-zinc-400">
            {t("employees", { count: rows.length })} · {t("sendingTo", { email: DEV_EMAIL_OVERRIDE })}
          </p>
        </div>
        <a href="/payroll" className="text-sm text-zinc-400 hover:text-black dark:hover:text-white">
          {t("changeFile")}
        </a>
      </div>

      {isDuplicate && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-800 dark:bg-yellow-950">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">{t("duplicateWarning")}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {cols.map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-black dark:text-white">{row.empleado}</td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{row.cedula}</td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{row.puesto}</td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">{fmt(row.salario)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">{fmt(row.total)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-red-500">{fmt(row.ccss)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-red-500">{fmt(row.bcoPop)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-red-500">{fmt(row.embargos)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-green-600">{fmt(row.netoAPagar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSend}
          disabled={status === "queuing"}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {status === "queuing" ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black" />
              {t("queuing")}
            </span>
          ) : (
            t("sendButton", { count: rows.length })
          )}
        </button>
        <p className="text-sm text-zinc-400">{t("onePerEmployee")}</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
