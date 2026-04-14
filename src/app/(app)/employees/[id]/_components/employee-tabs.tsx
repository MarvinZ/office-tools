"use client";

import { useState } from "react";
import Link from "next/link";
import { User, FileText, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EmployeeWithRelations } from "@/services/employees/employees";
import EmployeeDocumentUpload from "./document-upload";

const TAB_IDS = ["overview", "documents", "assets"] as const;
type TabId = typeof TAB_IDS[number];

const TAB_ICONS = { overview: User, documents: FileText, assets: Package };

export default function EmployeeTabs({ employee }: { employee: EmployeeWithRelations }) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const [tab, setTab] = useState<TabId>("overview");

  const tabLabels: Record<TabId, string> = {
    overview:  t("detail.tabOverview"),
    documents: t("detail.tabDocuments"),
    assets:    t("detail.tabAssets"),
  };

  const compLabel: Record<string, string> = {
    hourly:  t("detail.compHourly"),
    monthly: t("detail.compMonthly"),
    annual:  t("detail.compAnnual"),
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
              {id === "documents" && employee.documents.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{employee.documents.length}</span>
              )}
              {id === "assets" && employee.assignedAssets.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{employee.assignedAssets.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {/* Contact */}
          <Section title={t("detail.sectionContact")}>
            {[
              { label: t("detail.fieldCompanyEmail"),  value: employee.companyEmail },
              { label: t("detail.fieldPersonalEmail"), value: employee.personalEmail ?? tc("notApplicable") },
              { label: t("detail.fieldPhone"),         value: employee.phone ?? tc("notApplicable") },
            ].map(Row)}
          </Section>

          {/* Role */}
          <Section title={t("detail.sectionRole")}>
            {[
              { label: t("detail.fieldPosition"),   value: employee.position },
              { label: t("detail.fieldDepartment"), value: employee.department?.name ?? tc("notApplicable") },
              { label: t("detail.fieldHireDate"),   value: new Date(employee.hireDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
              ...(employee.terminationDate ? [{ label: t("detail.fieldTerminationDate"), value: new Date(employee.terminationDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) }] : []),
            ].map(Row)}
          </Section>

          {/* Compensation */}
          {(employee.compensationAmount || employee.compensationType) && (
            <Section title={t("detail.sectionCompensation")}>
              {[
                {
                  label: t("detail.fieldAmount"),
                  value: employee.compensationAmount
                    ? `$${Number(employee.compensationAmount).toLocaleString()} ${employee.compensationType ? compLabel[employee.compensationType] ?? "" : ""}`
                    : tc("notApplicable"),
                },
              ].map(Row)}
            </Section>
          )}

          {/* Address */}
          {(employee.addressStreet || employee.addressCity) && (
            <Section title={t("detail.sectionAddress")}>
              {[
                { label: t("detail.fieldStreet"),  value: employee.addressStreet ?? tc("notApplicable") },
                { label: t("detail.fieldCity"),    value: employee.addressCity ?? tc("notApplicable") },
                { label: t("detail.fieldState"),   value: employee.addressState ?? tc("notApplicable") },
                { label: t("detail.fieldZip"),     value: employee.addressZip ?? tc("notApplicable") },
                { label: t("detail.fieldCountry"), value: employee.addressCountry ?? tc("notApplicable") },
              ].filter((r) => r.value !== tc("notApplicable")).map(Row)}
            </Section>
          )}

          {/* Emergency contact */}
          {employee.emergencyContactName && (
            <Section title={t("detail.sectionEmergency")}>
              {[
                { label: t("detail.fieldEmergencyName"),     value: employee.emergencyContactName },
                { label: t("detail.fieldEmergencyPhone"),    value: employee.emergencyContactPhone ?? tc("notApplicable") },
                { label: t("detail.fieldEmergencyRelation"), value: employee.emergencyContactRelation ?? tc("notApplicable") },
              ].map(Row)}
            </Section>
          )}

          {/* Notes */}
          {employee.notes && (
            <div className="col-span-full flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("detail.sectionNotes")}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{employee.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Documents */}
      {tab === "documents" && (
        <EmployeeDocumentUpload employeeId={employee.id} documents={employee.documents} />
      )}

      {/* Assigned Assets */}
      {tab === "assets" && (
        <div className="flex flex-col gap-3">
          {employee.assignedAssets.length === 0 ? (
            <p className="text-sm text-zinc-400">{t("detail.assetsEmpty")}</p>
          ) : employee.assignedAssets.map((a) => (
            <Link
              key={a.id}
              href={`/assets/${a.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <div>
                <p className="text-sm font-medium text-black dark:text-white">{a.name}</p>
                <p className="text-xs text-zinc-400">{a.brand} · {a.category}</p>
              </div>
              <span className="text-xs text-zinc-400">{t("detail.assetsViewLink")}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
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
    <div key={label} className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium text-black dark:text-white text-right">{value}</dd>
    </div>
  );
}
