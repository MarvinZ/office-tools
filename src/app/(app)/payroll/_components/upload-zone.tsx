"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPayrollFile } from "../actions";

export default function UploadZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "parsing">("idle");
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setStatus("uploading");

    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadPayrollFile(formData);

    if ("error" in result) {
      setError(result.error);
      setStatus("idle");
      return;
    }

    setStatus("parsing");
    router.push(`/payroll/${result.batchId}${result.isDuplicate ? "?duplicate=true" : ""}`);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const busy = status !== "idle";

  return (
    <div className="flex flex-col gap-4">
      <label
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`group flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center transition-colors
          ${busy
            ? "cursor-default border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            : "border-zinc-300 bg-white hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-400"
          }`}
      >
        {busy ? (
          <>
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-black dark:border-t-white" />
            <p className="text-sm text-zinc-500">
              {status === "uploading" ? "Uploading file..." : "Processing..."}
            </p>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-7 w-7 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-black dark:text-white">
                Drop your payroll file here, or <span className="underline">browse</span>
              </p>
              <p className="mt-1 text-xs text-zinc-400">.xlsx or .xls files only</p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleChange}
          disabled={busy}
          className="hidden"
        />
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
