"use client";

import { useRef, useState } from "react";
import { uploadFile, parsePayrollFile, sendPayrollEmails, type PayrollRow } from "./actions";

type Step = "upload" | "preview" | "sending" | "done";

const fmt = (n: number) =>
  n === 0 ? "—" : `₡${n.toLocaleString("es-CR")}`;

export default function PayrollProcessor() {
  const [step, setStep] = useState<Step>("upload");
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setRows([]);
    setFileName("");
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    const uploaded = await uploadFile(formData);

    if ("error" in uploaded) {
      setError(uploaded.error ?? "Upload failed.");
      setUploading(false);
      return;
    }

    setFileName(uploaded.name);
    setUploading(false);
    setParsing(true);

    const parsed = await parsePayrollFile(uploaded.url);
    if (parsed.error || !parsed.rows?.length) {
      setError(parsed.error ?? "No rows found in file.");
      setParsing(false);
      return;
    }

    setRows(parsed.rows);
    setParsing(false);
    setStep("preview");
  }

  async function handleSend() {
    setStep("sending");
    const res = await sendPayrollEmails(rows);
    setResult(res);
    setStep("done");
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "preview", "done"] as const).map((s, i) => {
          const labels = ["Upload", "Review", "Send"];
          const active = step === s || (step === "sending" && s === "done");
          const done =
            (s === "upload" && (step === "preview" || step === "sending" || step === "done")) ||
            (s === "preview" && (step === "sending" || step === "done"));
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold
                ${done ? "bg-black text-white dark:bg-white dark:text-black" :
                  active ? "border-2 border-black text-black dark:border-white dark:text-white" :
                  "border-2 border-zinc-200 text-zinc-400 dark:border-zinc-700"}`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={done || active ? "text-black dark:text-white" : "text-zinc-400"}>
                {labels[i]}
              </span>
              {i < 2 && <span className="text-zinc-300 dark:text-zinc-700">—</span>}
            </div>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="flex flex-col gap-3">
          {uploading || parsing ? (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-black dark:border-t-white" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {uploading ? "Uploading file..." : "Reading payroll data..."}
              </span>
            </div>
          ) : (
            <label className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-zinc-200 bg-white p-10 text-center transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-500">
              <div className="text-3xl">📂</div>
              <div>
                <p className="text-sm font-medium text-black dark:text-white">Click to upload payroll file</p>
                <p className="mt-1 text-xs text-zinc-400">.xlsx or .xls files only</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-black dark:text-white">{fileName}</p>
              <p className="text-xs text-zinc-400">{rows.length} employees (dev: limited to 3) · Emails → marvinzzz@gmail.com</p>
            </div>
            <button onClick={reset} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
              ← Change file
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  {["Empleado", "Cédula", "Puesto", "Salario", "Total Bruto", "CCSS", "Bco Popular", "Embargos", "Neto a Pagar"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-4 py-3 font-medium text-black dark:text-white">{row.empleado}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.cedula}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.puesto}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{fmt(row.salario)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{fmt(row.total)}</td>
                    <td className="px-4 py-3 text-red-500">{fmt(row.ccss)}</td>
                    <td className="px-4 py-3 text-red-500">{fmt(row.bcoPop)}</td>
                    <td className="px-4 py-3 text-red-500">{fmt(row.embargos)}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">{fmt(row.netoAPagar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSend}
              className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Send {rows.length} payroll emails
            </button>
            <p className="text-xs text-zinc-400">This will send one email per employee.</p>
          </div>
        </div>
      )}

      {/* Step: Sending */}
      {step === "sending" && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-black dark:border-t-white" />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Sending emails...</span>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && result && (
        <div className="flex flex-col gap-4">
          <div className={`rounded-xl border p-6 ${result.failed === 0 ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" : "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"}`}>
            <p className={`text-sm font-semibold ${result.failed === 0 ? "text-green-700 dark:text-green-400" : "text-yellow-700 dark:text-yellow-400"}`}>
              {result.failed === 0
                ? `All ${result.sent} emails sent successfully.`
                : `${result.sent} sent, ${result.failed} failed.`}
            </p>
          </div>
          <button onClick={reset} className="self-start text-sm text-zinc-500 hover:text-black dark:hover:text-white">
            ← Process another file
          </button>
        </div>
      )}
    </div>
  );
}
