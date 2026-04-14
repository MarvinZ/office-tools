"use server";

import { put } from "@vercel/blob";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { updateEmployee } from "@/services/employees/employees";
import { addEmployeeDocument, deleteEmployeeDocument } from "@/services/employees/employee-documents";
import { DEV_TENANT_ID } from "@/lib/constants";

export async function updateEmployeeAction(employeeId: string, formData: FormData) {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated." };

  // Avatar upload (optional — only if a new file was picked)
  let avatarUrl: string | undefined;
  const avatarFile = formData.get("avatar") as File | null;
  if (avatarFile && avatarFile.size > 0) {
    const blob = await put(
      `employees/${DEV_TENANT_ID}/avatars/${crypto.randomUUID()}-${avatarFile.name}`,
      avatarFile,
      { access: "public" }
    );
    avatarUrl = blob.url;
  }

  const compensationRaw = formData.get("compensationAmount") as string | null;

  const update: Parameters<typeof updateEmployee>[2] = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    companyEmail: formData.get("companyEmail") as string,
    personalEmail: (formData.get("personalEmail") as string | null) || null,
    phone: (formData.get("phone") as string | null) || null,
    position: formData.get("position") as string,
    departmentId: (formData.get("departmentId") as string | null) || null,
    status: formData.get("status") as "active" | "on_leave" | "terminated",
    hireDate: new Date(formData.get("hireDate") as string),
    terminationDate: (formData.get("terminationDate") as string | null)
      ? new Date(formData.get("terminationDate") as string)
      : null,
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
    notes: (formData.get("notes") as string | null) || null,
    ...(avatarUrl ? { avatarUrl } : {}),
  };

  await updateEmployee(DEV_TENANT_ID, employeeId, update);

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  return { ok: true };
}

export async function uploadEmployeeDocumentAction(employeeId: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const file = formData.get("file") as File;
  const name = (formData.get("name") as string | null)?.trim() || file.name;
  const type = (formData.get("type") as "contract" | "id_document" | "other") ?? "other";

  if (!file || file.size === 0) return { error: "No file provided." };

  const blob = await put(
    `employees/${DEV_TENANT_ID}/${employeeId}/documents/${Date.now()}-${file.name}`,
    file,
    { access: "public" }
  );

  await addEmployeeDocument(DEV_TENANT_ID, employeeId, userId, { name, type, blobUrl: blob.url });

  revalidatePath(`/employees/${employeeId}`);
  return { url: blob.url };
}

export async function deleteEmployeeDocumentAction(employeeId: string, documentId: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  await deleteEmployeeDocument(DEV_TENANT_ID, documentId);

  revalidatePath(`/employees/${employeeId}`);
  return { ok: true };
}
