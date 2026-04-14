"use client";

import { useState } from "react";
import { ExternalLink, FileText, Image, Clock, Info } from "lucide-react";
import type { AssetWithRelations } from "@/services/assets/assets";

const TABS = [
  { id: "overview",   label: "Overview",   icon: Info },
  { id: "photos",     label: "Photos",     icon: Image },
  { id: "documents",  label: "Documents",  icon: FileText },
  { id: "history",    label: "History",    icon: Clock },
] as const;

type TabId = typeof TABS[number]["id"];

const docTypeLabel: Record<string, string> = {
  invoice: "Invoice",
  manual: "Manual",
  warranty: "Warranty",
  other: "Document",
};

const historyLabel: Record<string, string> = {
  created: "Asset created",
  checked_out: "Checked out",
  checked_in: "Checked in",
  maintenance_start: "Maintenance started",
  maintenance_end: "Maintenance ended",
  updated: "Updated",
  document_added: "Document added",
  photo_added: "Photo added",
};

const historyColor: Record<string, string> = {
  created: "bg-zinc-200 dark:bg-zinc-700",
  checked_out: "bg-blue-400",
  checked_in: "bg-green-400",
  maintenance_start: "bg-yellow-400",
  maintenance_end: "bg-green-400",
  updated: "bg-zinc-300 dark:bg-zinc-600",
  document_added: "bg-purple-400",
  photo_added: "bg-purple-400",
};

export default function AssetTabs({ asset }: { asset: AssetWithRelations }) {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === id
                ? "border-black text-black dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Icon size={14} />
            {label}
            {id === "photos" && asset.photos.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{asset.photos.length}</span>
            )}
            {id === "documents" && asset.documents.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{asset.documents.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Identification</h3>
            <dl className="flex flex-col gap-3">
              {[
                { label: "Serial Number", value: asset.serialNumber, mono: true },
                { label: "Barcode", value: asset.barcode, mono: true },
                { label: "Brand", value: asset.brand },
                { label: "Model", value: asset.model },
                { label: "Category", value: asset.category },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
                  <dt className="text-sm text-zinc-500">{label}</dt>
                  <dd className={`text-sm font-medium text-black dark:text-white ${mono ? "font-mono" : ""}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Purchase & Warranty</h3>
            <dl className="flex flex-col gap-3">
              {[
                { label: "Purchase Date", value: new Date(asset.purchaseDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
                { label: "Purchase Price", value: `$${Number(asset.purchasePrice).toLocaleString()}` },
                { label: "Supplier", value: asset.supplier },
                { label: "Warranty Until", value: new Date(asset.warrantyExpiry).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
                  <dt className="text-sm text-zinc-500">{label}</dt>
                  <dd className="text-sm font-medium text-black dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
            {asset.buyUrl && (
              <a
                href={asset.buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-black dark:hover:text-white"
              >
                <ExternalLink size={13} />
                Where to buy
              </a>
            )}
          </div>

          {(asset.notes || (asset.tags && asset.tags.length > 0)) && (
            <div className="col-span-full flex flex-col gap-4">
              {asset.notes && (
                <div className="flex flex-col gap-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Notes</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{asset.notes}</p>
                </div>
              )}
              {asset.tags && asset.tags.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {asset.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Photos */}
      {tab === "photos" && (
        <div>
          {asset.photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 py-16 dark:border-zinc-800">
              <p className="text-sm text-zinc-400">No photos yet.</p>
              <button className="text-sm text-black underline dark:text-white">Upload photo</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {asset.photos.map((photo, i) => (
                <a key={photo.id} href={photo.blobUrl} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <img src={photo.blobUrl} alt={`${asset.name} photo ${i + 1}`} className="h-48 w-full object-cover transition-transform group-hover:scale-105" />
                </a>
              ))}
              <button className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 text-sm text-zinc-400 hover:border-zinc-400 dark:border-zinc-800">
                + Add photo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Documents */}
      {tab === "documents" && (
        <div className="flex flex-col gap-3">
          {asset.documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 py-16 dark:border-zinc-800">
              <p className="text-sm text-zinc-400">No documents yet.</p>
              <button className="text-sm text-black underline dark:text-white">Upload document</button>
            </div>
          ) : (
            <>
              {asset.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <FileText size={15} className="text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black dark:text-white">{doc.name}</p>
                      <p className="text-xs text-zinc-400">{docTypeLabel[doc.type]} · Added {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <a href={doc.blobUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">Download</a>
                </div>
              ))}
              <button className="self-start text-sm text-zinc-400 hover:text-black dark:hover:text-white">+ Upload document</button>
            </>
          )}
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="flex flex-col">
          {asset.history.length === 0 ? (
            <p className="text-sm text-zinc-400">No history yet.</p>
          ) : (
            [...asset.history].reverse().map((entry, i) => (
              <div key={entry.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${historyColor[entry.action] ?? "bg-zinc-300"}`} />
                  {i < asset.history.length - 1 && <div className="w-px flex-1 bg-zinc-100 dark:bg-zinc-800 mt-1" />}
                </div>
                <div className="flex flex-col gap-0.5 pb-6">
                  <p className="text-sm font-medium text-black dark:text-white">{historyLabel[entry.action]}</p>
                  {entry.notes && <p className="text-sm text-zinc-500">{entry.notes}</p>}
                  <p className="text-xs text-zinc-400">
                    {entry.user} · {new Date(entry.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
