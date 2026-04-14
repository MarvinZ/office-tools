"use client";

import { useState } from "react";
import Link from "next/link";
import { User, FileText, Package } from "lucide-react";
import type { EmployeeWithRelations } from "@/services/employees/employees";
import EmployeeDocumentUpload from "./document-upload";

const TABS = [
  { id: "overview",  label: "Overview",        icon: User },
  { id: "documents", label: "Documents",        icon: FileText },
  { id: "assets",    label: "Assigned Assets",  icon: Package },
] as const;

type TabId = typeof TABS[number]["id"];

const COMP_LABEL: Record<string, string> = { hourly: "/ hr", monthly: "/ mo", annual: "/ yr" };

export default function EmployeeTabs({ employee }: { employee: EmployeeWithRelations }) {
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
            {id === "documents" && employee.documents.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{employee.documents.length}</span>
            )}
            {id === "assets" && employee.assignedAssets.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{employee.assignedAssets.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {/* Contact */}
          <Section title="Contact">
            {[
              { label: "Company email", value: employee.companyEmail },
              { label: "Personal email", value: employee.personalEmail ?? "—" },
              { label: "Phone", value: employee.phone ?? "—" },
            ].map(Row)}
          </Section>

          {/* Role */}
          <Section title="Role">
            {[
              { label: "Position", value: employee.position },
              { label: "Department", value: employee.department?.name ?? "—" },
              { label: "Hire date", value: new Date(employee.hireDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
              ...(employee.terminationDate ? [{ label: "Termination date", value: new Date(employee.terminationDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) }] : []),
            ].map(Row)}
          </Section>

          {/* Compensation */}
          {(employee.compensationAmount || employee.compensationType) && (
            <Section title="Compensation">
              {[
                {
                  label: "Amount",
                  value: employee.compensationAmount
                    ? `$${Number(employee.compensationAmount).toLocaleString()} ${employee.compensationType ? COMP_LABEL[employee.compensationType] ?? "" : ""}`
                    : "—",
                },
              ].map(Row)}
            </Section>
          )}

          {/* Address */}
          {(employee.addressStreet || employee.addressCity) && (
            <Section title="Address">
              {[
                { label: "Street", value: employee.addressStreet ?? "—" },
                { label: "City", value: employee.addressCity ?? "—" },
                { label: "State", value: employee.addressState ?? "—" },
                { label: "ZIP", value: employee.addressZip ?? "—" },
                { label: "Country", value: employee.addressCountry ?? "—" },
              ].filter((r) => r.value !== "—").map(Row)}
            </Section>
          )}

          {/* Emergency contact */}
          {employee.emergencyContactName && (
            <Section title="Emergency contact">
              {[
                { label: "Name", value: employee.emergencyContactName },
                { label: "Phone", value: employee.emergencyContactPhone ?? "—" },
                { label: "Relationship", value: employee.emergencyContactRelation ?? "—" },
              ].map(Row)}
            </Section>
          )}

          {/* Notes */}
          {employee.notes && (
            <div className="col-span-full flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Notes</p>
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
            <p className="text-sm text-zinc-400">No assets assigned.</p>
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
              <span className="text-xs text-zinc-400">View →</span>
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
