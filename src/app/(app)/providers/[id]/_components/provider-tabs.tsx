"use client";

import { useState } from "react";
import { Truck, Users, FileText, StickyNote } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProviderWithRelations } from "@/services/providers/providers";

const TAB_IDS = ["overview", "contacts", "documents", "notes"] as const;
type TabId = typeof TAB_IDS[number];
const TAB_ICONS = { overview: Truck, contacts: Users, documents: FileText, notes: StickyNote };

const DOC_TYPE_ICONS: Record<string, string> = {
  contract: "📝", price_list: "💰", certificate: "🏅", invoice: "🧾", other: "📄",
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      <dl className="flex flex-col gap-3">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-black dark:text-white">{value}</dd>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <span key={i} className={`text-lg ${i <= rating ? "text-amber-400" : "text-zinc-200 dark:text-zinc-700"}`}>★</span>
      ))}
    </div>
  );
}

export default function ProviderTabs({ provider }: { provider: ProviderWithRelations }) {
  const t = useTranslations("providers");
  const tc = useTranslations("common");
  const [tab, setTab] = useState<TabId>("overview");

  const tabLabels: Record<TabId, string> = {
    overview:  t("detail.tabOverview"),
    contacts:  t("detail.tabContacts"),
    documents: t("detail.tabDocuments"),
    notes:     t("detail.tabNotes"),
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TAB_IDS.map((id) => {
          const Icon = TAB_ICONS[id];
          const count =
            id === "contacts" ? provider.contacts.length :
            id === "documents" ? provider.documents.length :
            id === "notes" ? provider.notes.length : null;
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
              {count != null && count > 0 && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <Section title={t("detail.sectionCompany")}>
            {[
              { label: t("detail.fieldLegalName"),    value: provider.legalName },
              { label: t("detail.fieldTaxId"),        value: provider.taxId ?? tc("notApplicable") },
              { label: t("detail.fieldCategory"),     value: provider.category },
              { label: t("detail.fieldWebsite"),      value: provider.website ?? tc("notApplicable") },
              { label: t("detail.fieldPartnerSince"), value: fmtDate(provider.partnerSince) },
            ].map((r) => <Row key={r.label} {...r} />)}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
              <dt className="text-sm text-zinc-500">{t("detail.fieldRating")}</dt>
              <dd><Stars rating={provider.rating} /></dd>
            </div>
          </Section>

          <Section title={t("detail.sectionSupply")}>
            {[
              { label: t("detail.fieldProducts"),       value: provider.productsServices },
              { label: t("detail.fieldLeadTime"),       value: provider.leadTimeDays != null ? `${provider.leadTimeDays} ${t("detail.days")}` : tc("notApplicable") },
              { label: t("detail.fieldMinOrder"),       value: provider.minimumOrderAmount != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: provider.currency }).format(parseFloat(provider.minimumOrderAmount)) : tc("notApplicable") },
              { label: t("detail.fieldContractExpiry"), value: fmtDate(provider.contractExpiry) },
            ].map((r) => <Row key={r.label} {...r} />)}
          </Section>

          <Section title={t("detail.sectionPayment")}>
            {[
              { label: t("detail.fieldPaymentTerms"), value: t(`paymentTerms.${provider.paymentTerms}`) },
              { label: t("detail.fieldCurrency"),     value: provider.currency },
              { label: t("detail.fieldBankName"),     value: provider.bankName ?? tc("notApplicable") },
              { label: t("detail.fieldBankAccount"),  value: provider.bankAccount ?? tc("notApplicable") },
              { label: t("detail.fieldBankIban"),     value: provider.bankIban ?? tc("notApplicable") },
              { label: t("detail.fieldBankSwift"),    value: provider.bankSwift ?? tc("notApplicable") },
            ].filter((r) => r.value !== tc("notApplicable")).map((r) => <Row key={r.label} {...r} />)}
          </Section>

          <Section title={t("detail.sectionAddress")}>
            {[
              { label: t("detail.fieldStreet"),  value: provider.addressStreet },
              { label: t("detail.fieldCity"),    value: provider.addressCity },
              { label: t("detail.fieldState"),   value: provider.addressState },
              { label: t("detail.fieldZip"),     value: provider.addressZip },
              { label: t("detail.fieldCountry"), value: provider.addressCountry },
            ].filter((r): r is { label: string; value: string } => !!r.value).map((r) => <Row key={r.label} {...r} />)}
          </Section>

          {provider.tags.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("detail.sectionTags")}</h3>
              <div className="flex flex-wrap gap-2">
                {provider.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contacts */}
      {tab === "contacts" && (
        <div className="flex flex-col gap-3">
          {provider.contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">{t("detail.contactsEmpty")}</p>
          ) : provider.contacts.map((contact) => (
            <div key={contact.id} className="flex items-start justify-between rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {contact.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-black dark:text-white">{contact.name}</p>
                    {contact.isPrimary && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{t("detail.primaryBadge")}</span>
                    )}
                  </div>
                  {contact.title && <p className="text-sm text-zinc-500">{contact.title}</p>}
                  <div className="mt-1 flex flex-wrap gap-3">
                    <a href={`mailto:${contact.email}`} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">{contact.email}</a>
                    {contact.phone && <span className="text-xs text-zinc-400">{contact.phone}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents */}
      {tab === "documents" && (
        <div className="flex flex-col gap-3">
          {provider.documents.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">{t("detail.documentsEmpty")}</p>
          ) : provider.documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="text-xl">{DOC_TYPE_ICONS[doc.type] ?? "📄"}</span>
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">{doc.name}</p>
                  <p className="text-xs text-zinc-400">{t(`docType.${doc.type}`)} · {tc("added")} {fmtDate(doc.uploadedAt)}</p>
                </div>
              </div>
              <a href={doc.blobUrl} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">{tc("download")}</a>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {tab === "notes" && (
        <div className="flex flex-col gap-4">
          {provider.notes.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">{t("detail.notesEmpty")}</p>
          ) : provider.notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{note.body}</p>
              <p className="mt-2 text-xs text-zinc-400">{fmtDate(note.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
