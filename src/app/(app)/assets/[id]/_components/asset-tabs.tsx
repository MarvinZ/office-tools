"use client";

import { useState } from "react";
import { ExternalLink, FileText, Image, Clock, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AssetWithRelations } from "@/services/assets/assets";
import PhotoUpload from "./photo-upload";
import DocumentUpload from "./document-upload";

const TAB_IDS = ["overview", "photos", "documents", "history"] as const;
type TabId = typeof TAB_IDS[number];

const TAB_ICONS = { overview: Info, photos: Image, documents: FileText, history: Clock };

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
  const t = useTranslations("assets");
  const [tab, setTab] = useState<TabId>("overview");

  const tabLabels: Record<TabId, string> = {
    overview:  t("detail.tabOverview"),
    photos:    t("detail.tabPhotos"),
    documents: t("detail.tabDocuments"),
    history:   t("detail.tabHistory"),
  };

  const historyLabel: Record<string, string> = {
    created:           t("detail.historyCreated"),
    checked_out:       t("detail.historyCheckedOut"),
    checked_in:        t("detail.historyCheckedIn"),
    maintenance_start: t("detail.historyMaintenanceStart"),
    maintenance_end:   t("detail.historyMaintenanceEnd"),
    updated:           t("detail.historyUpdated"),
    document_added:    t("detail.historyDocumentAdded"),
    photo_added:       t("detail.historyPhotoAdded"),
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TAB_IDS.map((id) => {
          const Icon = TAB_ICONS[id];
          return (
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
              {tabLabels[id]}
              {id === "photos" && asset.photos.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{asset.photos.length}</span>
              )}
              {id === "documents" && asset.documents.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{asset.documents.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("detail.sectionIdentification")}</h3>
            <dl className="flex flex-col gap-3">
              {[
                { label: t("detail.fieldSerial"),   value: asset.serialNumber, mono: true },
                { label: t("detail.fieldBarcode"),  value: asset.barcode,      mono: true },
                { label: t("detail.fieldBrand"),    value: asset.brand },
                { label: t("detail.fieldModel"),    value: asset.model },
                { label: t("detail.fieldCategory"), value: asset.category },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
                  <dt className="text-sm text-zinc-500">{label}</dt>
                  <dd className={`text-sm font-medium text-black dark:text-white ${mono ? "font-mono" : ""}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("detail.sectionPurchase")}</h3>
            <dl className="flex flex-col gap-3">
              {[
                { label: t("detail.fieldPurchaseDate"),  value: new Date(asset.purchaseDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
                { label: t("detail.fieldPurchasePrice"), value: `$${Number(asset.purchasePrice).toLocaleString()}` },
                { label: t("detail.fieldSupplier"),      value: asset.supplier },
                { label: t("detail.fieldWarrantyUntil"), value: new Date(asset.warrantyExpiry).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
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
                {t("detail.whereToBuy")}
              </a>
            )}
          </div>

          {(asset.notes || (asset.tags && asset.tags.length > 0)) && (
            <div className="col-span-full flex flex-col gap-4">
              {asset.notes && (
                <div className="flex flex-col gap-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("detail.sectionNotes")}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{asset.notes}</p>
                </div>
              )}
              {asset.tags && asset.tags.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("detail.sectionTags")}</h3>
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
        <PhotoUpload assetId={asset.id} photos={asset.photos} />
      )}

      {/* Documents */}
      {tab === "documents" && (
        <DocumentUpload assetId={asset.id} documents={asset.documents} />
      )}

      {/* History */}
      {tab === "history" && (
        <div className="flex flex-col">
          {asset.history.length === 0 ? (
            <p className="text-sm text-zinc-400">{t("detail.historyEmpty")}</p>
          ) : (
            [...asset.history].reverse().map((entry, i) => (
              <div key={entry.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${historyColor[entry.action] ?? "bg-zinc-300"}`} />
                  {i < asset.history.length - 1 && <div className="w-px flex-1 bg-zinc-100 dark:bg-zinc-800 mt-1" />}
                </div>
                <div className="flex flex-col gap-0.5 pb-6">
                  <p className="text-sm font-medium text-black dark:text-white">{historyLabel[entry.action] ?? entry.action}</p>
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
