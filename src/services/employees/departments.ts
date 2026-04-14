import { eq } from "drizzle-orm";
import { db } from "@/db";
import { departments } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type DepartmentRow = InferSelectModel<typeof departments>;

export async function listDepartments(tenantId: string): Promise<DepartmentRow[]> {
  return db
    .select()
    .from(departments)
    .where(eq(departments.tenantId, tenantId))
    .orderBy(departments.name);
}

export async function createDepartment(tenantId: string, name: string): Promise<DepartmentRow> {
  const [row] = await db
    .insert(departments)
    .values({ id: crypto.randomUUID(), tenantId, name })
    .returning();
  return row;
}
