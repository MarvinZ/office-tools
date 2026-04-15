import { getTranslations } from "next-intl/server";
import { listEmployees } from "@/services/employees/employees";
import { listDepartments } from "@/services/employees/departments";
import { requireTenant } from "@/services/tenants";
import EmployeeListClient from "./_components/employee-list-client";
import AddEmployeeModal from "./_components/add-employee-modal";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const tenant = await requireTenant();
  const [employees, departments, t] = await Promise.all([
    listEmployees(tenant.id),
    listDepartments(tenant.id),
    getTranslations("employees"),
  ]);

  const active = employees.filter((e) => e.status === "active").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("page.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.subtitle", { total: employees.length, active })}
          </p>
        </div>
        <AddEmployeeModal departments={departments} />
      </div>

      <EmployeeListClient employees={employees} departments={departments} />
    </div>
  );
}
