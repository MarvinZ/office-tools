"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFile, listFiles } from "./actions";

type BlobFile = {
  url: string;
  name: string;
  uploadedAt: Date;
};

export default function FileManager() {
  const [files, setFiles] = useState<BlobFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadFiles() {
    const result = await listFiles();
    setFiles(result);
  }

  useEffect(() => {
    loadFiles();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadFile(formData);

    if ("error" in result) {
      setError(result.error ?? "Upload failed.");
    } else {
      await loadFiles();
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          onChange={handleUpload}
          disabled={uploading}
          className="text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 disabled:opacity-50 dark:text-zinc-400 dark:file:bg-white dark:file:text-black"
        />
        {uploading && <span className="text-sm text-zinc-500">Uploading...</span>}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {files.length > 0 ? (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {files.map((f) => (
            <li key={f.url} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-black dark:text-white">{f.name}</span>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-500 hover:text-black dark:hover:text-white"
              >
                View
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-400">No files uploaded yet.</p>
      )}
    </div>
  );
}
