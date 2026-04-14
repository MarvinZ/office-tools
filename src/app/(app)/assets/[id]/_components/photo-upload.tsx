"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { uploadPhotoAction, deletePhotoAction } from "../actions";
import type { AssetPhotoRow } from "@/services/assets/photos";

export default function PhotoUpload({ assetId, photos }: { assetId: string; photos: AssetPhotoRow[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadPhotoAction(assetId, fd);
      if ("error" in result) { setError(result.error ?? "Upload failed."); break; }
    }
    setUploading(false);
  }

  async function handleDelete(photoId: string, blobUrl: string) {
    await deletePhotoAction(assetId, photoId, blobUrl);
  }

  return (
    <div className="flex flex-col gap-4">
      {photos.length === 0 && !uploading ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 py-16 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
        >
          <p className="text-sm text-zinc-400">No photos yet.</p>
          <span className="text-sm text-black underline dark:text-white">Upload photo</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, i) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <a href={photo.blobUrl} target="_blank" rel="noopener noreferrer">
                <img src={photo.blobUrl} alt={`Photo ${i + 1}`} className="h-48 w-full object-cover transition-transform group-hover:scale-105" />
              </a>
              <button
                onClick={() => handleDelete(photo.id, photo.blobUrl)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 text-sm text-zinc-400 transition-colors hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-800"
          >
            {uploading ? "Uploading..." : "+ Add photo"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
