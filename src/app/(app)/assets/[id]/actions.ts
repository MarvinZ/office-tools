"use server";

import { put, del } from "@vercel/blob";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { addPhoto, deletePhoto } from "@/services/assets/photos";
import { addDocument, deleteDocument } from "@/services/assets/documents";
import { updateAsset } from "@/services/assets/assets";
import { logHistory } from "@/services/assets/history";
import { requireTenant } from "@/services/tenants";

// ── Photos ────────────────────────────────────────────────────────────────────

export async function uploadPhotoAction(assetId: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const file = formData.get("file") as File;
  if (!file || file.size === 0) return { error: "No file provided." };

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext ?? "")) {
    return { error: "Only image files are accepted." };
  }

  const tenant = await requireTenant();
  const blob = await put(`assets/${tenant.id}/${assetId}/photos/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  await addPhoto(tenant.id, assetId, userId, blob.url);

  const user = await currentUser();
  const userName = user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "Unknown";
  await logHistory(tenant.id, assetId, userName, "photo_added");

  revalidatePath(`/assets/${assetId}`);
  return { url: blob.url };
}

export async function deletePhotoAction(assetId: string, photoId: string, blobUrl: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const tenant = await requireTenant();
  await del(blobUrl);
  await deletePhoto(tenant.id, photoId);

  revalidatePath(`/assets/${assetId}`);
  return { ok: true };
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function uploadDocumentAction(assetId: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const file = formData.get("file") as File;
  const name = (formData.get("name") as string | null)?.trim() || file.name;
  const type = (formData.get("type") as "invoice" | "manual" | "warranty" | "other") ?? "other";

  if (!file || file.size === 0) return { error: "No file provided." };

  const tenant = await requireTenant();
  const blob = await put(`assets/${tenant.id}/${assetId}/documents/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  await addDocument(tenant.id, assetId, userId, { name, type, blobUrl: blob.url });

  const user = await currentUser();
  const userName = user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "Unknown";
  await logHistory(tenant.id, assetId, userName, "document_added", `${name} (${type})`);

  revalidatePath(`/assets/${assetId}`);
  return { url: blob.url };
}

export async function deleteDocumentAction(assetId: string, documentId: string, blobUrl: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const tenant = await requireTenant();
  await del(blobUrl);
  await deleteDocument(tenant.id, documentId);

  revalidatePath(`/assets/${assetId}`);
  return { ok: true };
}

// ── Edit asset ────────────────────────────────────────────────────────────────

export async function editAssetAction(assetId: string, formData: FormData) {
  const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);
  if (!user) return { error: "Not authenticated." };

  const tagsRaw = (formData.get("tags") as string | null) ?? "";
  const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);

  await updateAsset(tenant.id, assetId, {
    name: formData.get("name") as string,
    category: formData.get("category") as "Electronics" | "Furniture" | "Vehicles" | "Equipment" | "Tools" | "Other",
    brand: formData.get("brand") as string,
    model: formData.get("model") as string,
    serialNumber: formData.get("serialNumber") as string,
    barcode: formData.get("barcode") as string,
    location: formData.get("location") as string,
    assignedToId: (formData.get("assignedToId") as string | null) || null,
    purchaseDate: new Date(formData.get("purchaseDate") as string),
    purchasePrice: formData.get("purchasePrice") as string,
    warrantyExpiry: new Date(formData.get("warrantyExpiry") as string),
    supplier: formData.get("supplier") as string,
    buyUrl: (formData.get("buyUrl") as string | null) || null,
    notes: (formData.get("notes") as string | null) || null,
    tags,
  });

  const userName = user.firstName ?? user.emailAddresses[0]?.emailAddress ?? "Unknown";
  await logHistory(tenant.id, assetId, userName, "updated");

  revalidatePath(`/assets/${assetId}`);
  return { ok: true };
}
