"use client";

import { useRef, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { uploadDocumentAction, deleteDocumentAction } from "../actions";
import type { AssetDocumentRow } from "@/services/assets/documents";

const DOC_TYPES = [
  { value: "invoice", label: "Invoice" },
  { value: "manual", label: "Manual" },
  { value: "warranty", label: "Warranty" },
  { value: "other", label: "Other" },
] as const;

const docTypeLabel: Record<string, string> = {
  invoice: "Invoice",
  manual: "Manual",
  warranty: "Warranty",
  other: "Document",
};

export default function DocumentUpload({ assetId, documents }: { assetId: string; documents: AssetDocumentRow[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState<"invoice" | "manual" | "warranty" | "other">("other");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setSelectedFile(file);
    setDocName(file.name);
    setShowForm(true);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", selectedFile);
    fd.append("name", docName);
    fd.append("type", docType);

    const result = await uploadDocumentAction(assetId, fd);
    if ("error" in result) {
      setError(result.error ?? "Upload failed.");
    } else {
      setShowForm(false);
      setSelectedFile(null);
      setDocName("");
      setDocType("other");
    }
    setPending(false);
  }

  async function handleDelete(docId: string, blobUrl: string) {
    await deleteDocumentAction(assetId, docId, blobUrl);
  }

  return (
    <div className="flex flex-col gap-3">
      {documents.length === 0 && !showForm ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 py-16 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
        >
          <p className="text-sm text-zinc-400">No documents yet.</p>
          <span className="text-sm text-black underline dark:text-white">Upload document</span>
        </div>
      ) : (
        <>
          {documents.map((doc) => (
            <div key={doc.id} className="group flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <FileText size={15} className="text-zinc-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">{doc.name}</p>
                  <p className="text-xs text-zinc-400">{docTypeLabel[doc.type]} · Added {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a href={doc.blobUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
                  Download
                </a>
                <button
                  onClick={() => handleDelete(doc.id, doc.blobUrl)}
                  className="text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500 dark:text-zinc-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {!showForm && (
            <button
              onClick={() => inputRef.current?.click()}
              className="self-start text-sm text-zinc-400 hover:text-black dark:hover:text-white"
            >
              + Upload document
            </button>
          )}
        </>
      )}

      {/* Upload form (shown after file is picked) */}
      {showForm && selectedFile && (
        <form onSubmit={handleUpload} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-medium text-black dark:text-white">New document</p>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Name</label>
            <input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as typeof docType)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setSelectedFile(null); }}
              className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm text-zinc-600 dark:border-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {pending ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      )}

      {error && !showForm && <p className="text-sm text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
