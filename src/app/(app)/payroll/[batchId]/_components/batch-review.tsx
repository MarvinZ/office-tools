"use client";

import { useState } from "react";
import type { PayrollRow } from "@/lib/payroll/parser";
import { sendPayrollBatch, type SendResult } from "../actions";

const fmt = (n: number) => (n === 0 ? "—" : `₡${n.toLocaleString("es-CR")}`);

type Props = {
  batchId: string;
  filename: string;
  rows: PayrollRow[];
  isDuplicate: boolean;
};

export default function BatchReview({ batchId, filename, rows, isDuplicate }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState("");

  async function handleSend() {
    setStatus("sending");
    setError("");

    const res = await sendPayrollBatch(batchId);

    if ("error" in res) {
      setError(res.error);
      setStatus("idle");
      return;
    }

    setResult(res);
    setStatus("done");
  }

  if (status === "done" && result) {
    return (
      <div className="flex flex-col gap-6">
        <div className={`rounded-2xl border p-6 ${result.failed === 0 ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" : "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"}`}>
          <p className={`text-base font-semibold ${result.failed === 0 ? "text-green-700 dark:text-green-400" : "text-yellow-700 dark:text-yellow-400"}`}>
            {result.failed === 0
              ? `All ${result.sent} emails sent successfully.`
              : `${result.sent} sent, ${result.failed} failed.`}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Emails were sent to marvinzzz@gmail.com (dev override).
          </p>
        </div>
        <a href="/payroll" className="self-start text-sm text-zinc-500 hover:text-black dark:hover:text-white">
          ← Process another file
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* File info */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-black dark:text-white">{filename}</p>
          <p className="text-xs text-zinc-400">
            {rows.length} employee{rows.length !== 1 ? "s" : ""} · Dev limit: {rows.length} rows · Sending to marvinzzz@gmail.com
          </p>
        </div>
        <a href="/payroll" className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
          ← Change file
        </a>
      </div>

      {isDuplicate && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-800 dark:bg-yellow-950">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            This file was already uploaded before. You can still send it.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {["Empleado", "Cédula", "Puesto", "Salario", "Total Bruto", "CCSS", "Bco Popular", "Embargos", "Neto a Pagar"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium text-black dark:text-white whitespace-nowrap">{row.empleado}</td>
                <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.cedula}</td>
                <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.puesto}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{fmt(row.salario)}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{fmt(row.total)}</td>
                <td className="px-4 py-3 text-red-500 whitespace-nowrap">{fmt(row.ccss)}</td>
                <td className="px-4 py-3 text-red-500 whitespace-nowrap">{fmt(row.bcoPop)}</td>
                <td className="px-4 py-3 text-red-500 whitespace-nowrap">{fmt(row.embargos)}</td>
                <td className="px-4 py-3 font-semibold text-green-600 whitespace-nowrap">{fmt(row.netoAPagar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSend}
          disabled={status === "sending"}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {status === "sending" ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black" />
              Sending...
            </span>
          ) : (
            `Send ${rows.length} payroll email${rows.length !== 1 ? "s" : ""}`
          )}
        </button>
        <p className="text-xs text-zinc-400">One email per employee.</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
