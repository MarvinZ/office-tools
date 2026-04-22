"use client";

import { useState } from "react";
import { Building2, Users, FileText, StickyNote } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ClientWithRelations } from "@/services/clients/clients";

const TAB_IDS = ["overview", "contacts", "documents", "notes"] as const;
type TabId = typeof TAB_IDS[number];
const TAB_ICONS = { overview: Building2, contacts: Users, documents: FileText, notes: StickyNote };

const DOC_TYPE_ICONS: Record<string, string> = {
  contract: "📝", nda: "🔒", proposal: "📊", invoice: "🧾", other: "📄",
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

export default function ClientTabs({ client }: { client: ClientWithRelations }) {
  const t = useTranslations("clients");
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
            id === "contacts" ? client.contacts.length :
            id === "documents" ? client.documents.length :
            id === "notes" ? client.notes.length : null;
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
              { label: t("detail.fieldLegalName"),   value: client.legalName },
              { label: t("detail.fieldTaxId"),       value: client.taxId },
              { label: t("detail.fieldIndustry"),    value: client.industry },
              { label: t("detail.fieldWebsite"),     value: client.website ?? tc("notApplicable") },
              { label: t("detail.fieldClientSince"), value: fmtDate(client.clientSince) },
            ].map((r) => <Row key={r.label} {...r} />)}
          </Section>

          <Section title={t("detail.sectionFinancial")}>
            {[
              { label: t("detail.fieldPaymentTerms"), value: t(`paymentTerms.${client.paymentTerms}`) },
              { label: t("detail.fieldCurrency"),     value: client.currency },
              { label: t("detail.fieldCreditLimit"),  value: client.creditLimit != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: client.currency }).format(parseFloat(client.creditLimit)) : tc("notApplicable") },
              { label: t("detail.fieldBillingEmail"), value: client.billingEmail },
            ].map((r) => <Row key={r.label} {...r} />)}
          </Section>

          <Section title={t("detail.sectionAddress")}>
            {[
              { label: t("detail.fieldStreet"),  value: client.addressStreet },
              { label: t("detail.fieldCity"),    value: client.addressCity },
              { label: t("detail.fieldState"),   value: client.addressState },
              { label: t("detail.fieldZip"),     value: client.addressZip },
              { label: t("detail.fieldCountry"), value: client.addressCountry },
            ].filter((r): r is { label: string; value: string } => !!r.value).map((r) => <Row key={r.label} {...r} />)}
          </Section>

          {client.tags.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("detail.sectionTags")}</h3>
              <div className="flex flex-wrap gap-2">
                {client.tags.map((tag) => (
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
          {client.contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">{t("detail.contactsEmpty")}</p>
          ) : client.contacts.map((contact) => (
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
          {client.documents.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">{t("detail.documentsEmpty")}</p>
          ) : client.documents.map((doc) => (
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
          {client.notes.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">{t("detail.notesEmpty")}</p>
          ) : client.notes.map((note) => (
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
