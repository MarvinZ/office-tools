"use server";

import { put } from "@vercel/blob";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createEmployee } from "@/services/employees/employees";
import { requireTenant } from "@/services/tenants";

export async function createEmployeeAction(formData: FormData) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) redirect("/sign-in");

  let avatarUrl: string | null = null;
  const avatarFile = formData.get("avatar") as File | null;
  if (avatarFile && avatarFile.size > 0) {
    const blob = await put(
      `employees/${tenant.id}/avatars/${crypto.randomUUID()}-${avatarFile.name}`,
      avatarFile,
      { access: "public" }
    );
    avatarUrl = blob.url;
  }

  const compensationRaw = formData.get("compensationAmount") as string | null;

  await createEmployee(tenant.id, user.id, {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    companyEmail: formData.get("companyEmail") as string,
    personalEmail: (formData.get("personalEmail") as string | null) || null,
    phone: (formData.get("phone") as string | null) || null,
    position: formData.get("position") as string,
    departmentId: (formData.get("departmentId") as string | null) || null,
    status: "active",
    hireDate: new Date(formData.get("hireDate") as string),
    terminationDate: null,
    addressStreet: (formData.get("addressStreet") as string | null) || null,
    addressCity: (formData.get("addressCity") as string | null) || null,
    addressState: (formData.get("addressState") as string | null) || null,
    addressZip: (formData.get("addressZip") as string | null) || null,
    addressCountry: (formData.get("addressCountry") as string | null) || null,
    compensationAmount: compensationRaw || null,
    compensationType: (formData.get("compensationType") as "hourly" | "monthly" | "annual" | null) || null,
    emergencyContactName: (formData.get("emergencyContactName") as string | null) || null,
    emergencyContactPhone: (formData.get("emergencyContactPhone") as string | null) || null,
    emergencyContactRelation: (formData.get("emergencyContactRelation") as string | null) || null,
    clerkUserId: null,
    notes: (formData.get("notes") as string | null) || null,
    avatarUrl,
  });

  redirect("/employees");
}
