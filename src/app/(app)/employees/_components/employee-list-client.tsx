"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EmployeeRow } from "@/services/employees/employees";
import type { DepartmentRow } from "@/services/employees/departments";
import { fullName } from "@/lib/employee-utils";

type EmployeeWithDept = EmployeeRow & { departmentName: string | null };

const STATUS_COLORS: Record<string, string> = {
  active:     "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  on_leave:   "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  terminated: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const ALL = "All";

export default function EmployeeListClient({
  employees,
  departments,
}: {
  employees: EmployeeWithDept[];
  departments: DepartmentRow[];
}) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [dept, setDept] = useState<string>(ALL);

  const filtered = employees.filter((e) => {
    const name = fullName(e).toLowerCase();
    const matchSearch =
      name.includes(search.toLowerCase()) ||
      e.companyEmail.toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase());
    const matchStatus = status === ALL || e.status === status;
    const matchDept = dept === ALL || e.departmentId === dept;
    return matchSearch && matchStatus && matchDept;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("list.searchPlaceholder")}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value={ALL}>{t("list.allStatuses")}</option>
          {(["active", "on_leave", "terminated"] as const).map((key) => (
            <option key={key} value={key}>{t(`status.${key}`)}</option>
          ))}
        </select>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value={ALL}>{t("list.allDepartments")}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {filtered.length !== employees.length && (
        <p className="text-sm text-zinc-400">{t("list.resultsCount", { filtered: filtered.length, total: employees.length })}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {[t("list.colEmployee"), t("list.colPosition"), t("list.colDepartment"), t("list.colContact"), t("list.colStatus"), ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-400">{t("list.empty")}</td>
              </tr>
            ) : filtered.map((e) => (
              <tr key={e.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {e.avatarUrl ? (
                      <img src={e.avatarUrl} alt={fullName(e)} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500 dark:bg-zinc-800">
                        {e.firstName[0]}{e.lastName[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-black dark:text-white">{fullName(e)}</p>
                      <p className="text-xs text-zinc-400">{e.companyEmail}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500">{e.position}</td>
                <td className="px-4 py-3 text-zinc-500">{e.departmentName ?? tc("notApplicable")}</td>
                <td className="px-4 py-3 text-zinc-500">{e.phone ?? tc("notApplicable")}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[e.status]}`}>
                    {t(`status.${e.status}` as any)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/employees/${e.id}`} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
                    {tc("viewLink")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
