import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getEmployee, fullName } from "@/services/employees/employees";
import { listDepartments } from "@/services/employees/departments";
import { DEV_TENANT_ID } from "@/lib/constants";
import EmployeeTabs from "./_components/employee-tabs";
import EditEmployeeModal from "./_components/edit-employee-modal";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:     { label: "active",     color: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  on_leave:   { label: "on_leave",   color: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  terminated: { label: "terminated", color: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const [employee, departments, t] = await Promise.all([
    getEmployee(DEV_TENANT_ID, id),
    listDepartments(DEV_TENANT_ID),
    getTranslations("employees"),
  ]);
  if (!employee) notFound();

  const cfg = STATUS_CONFIG[employee.status];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/employees" className="hover:text-black dark:hover:text-white">{t("detail.breadcrumb")}</Link>
        <span>›</span>
        <span className="text-black dark:text-white">{fullName(employee)}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {employee.avatarUrl ? (
            <img src={employee.avatarUrl} alt={fullName(employee)} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-xl font-semibold text-zinc-500 dark:bg-zinc-800">
              {employee.firstName[0]}{employee.lastName[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white">{fullName(employee)}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {employee.position}{employee.department ? ` · ${employee.department.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${cfg.color}`}>
            {t(`status.${employee.status}` as any)}
          </span>
          <EditEmployeeModal employee={employee} departments={departments} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("detail.statEmail"),    value: employee.companyEmail },
          { label: t("detail.statPhone"),    value: employee.phone ?? "—" },
          { label: t("detail.statHireDate"), value: new Date(employee.hireDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
          { label: t("detail.statAssets"),   value: String(employee.assignedAssets.length) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{s.label}</p>
            <p className="mt-1 text-base font-semibold text-black dark:text-white truncate">{s.value}</p>
          </div>
        ))}
      </div>

      <EmployeeTabs employee={employee} />
    </div>
  );
}
