import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { employees, employeeDocuments, departments, assets } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";
export { fullName } from "@/lib/employee-utils";

export type EmployeeRow = InferSelectModel<typeof employees>;
export type EmployeeDocumentRow = InferSelectModel<typeof employeeDocuments>;

export type EmployeeWithRelations = EmployeeRow & {
  department: InferSelectModel<typeof departments> | null;
  documents: EmployeeDocumentRow[];
  assignedAssets: InferSelectModel<typeof assets>[];
};

export async function listEmployees(tenantId: string): Promise<(EmployeeRow & { departmentName: string | null })[]> {
  const rows = await db
    .select({
      employee: employees,
      departmentName: departments.name,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(eq(employees.tenantId, tenantId))
    .orderBy(employees.lastName);

  return rows.map((r) => ({ ...r.employee, departmentName: r.departmentName ?? null }));
}

export async function getEmployee(tenantId: string, id: string): Promise<EmployeeWithRelations | null> {
  const rows = await db
    .select({ employee: employees, department: departments })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(eq(employees.tenantId, tenantId), eq(employees.id, id)));

  if (!rows[0]) return null;

  const { employee, department } = rows[0];

  const [docs, assignedAssets] = await Promise.all([
    db.select().from(employeeDocuments).where(eq(employeeDocuments.employeeId, id)),
    db.select().from(assets).where(and(eq(assets.tenantId, tenantId), eq(assets.assignedToId, id))),
  ]);

  return { ...employee, department: department ?? null, documents: docs, assignedAssets };
}

export async function createEmployee(
  tenantId: string,
  createdBy: string,
  data: Omit<EmployeeRow, "id" | "tenantId" | "createdBy" | "createdAt" | "updatedAt">
): Promise<EmployeeRow> {
  const [row] = await db
    .insert(employees)
    .values({ ...data, id: crypto.randomUUID(), tenantId, createdBy })
    .returning();
  return row;
}

export async function updateEmployee(
  tenantId: string,
  id: string,
  data: Partial<Omit<EmployeeRow, "id" | "tenantId" | "createdBy" | "createdAt">>
): Promise<EmployeeRow | null> {
  const [row] = await db
    .update(employees)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(employees.tenantId, tenantId), eq(employees.id, id)))
    .returning();
  return row ?? null;
}

