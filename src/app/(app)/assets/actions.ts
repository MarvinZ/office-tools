"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { createAsset } from "@/services/assets/assets";
import { logHistory } from "@/services/assets/history";
import { DEV_TENANT_ID } from "@/lib/constants";

export async function createAssetAction(formData: FormData) {
  const user = await currentUser();
  const userName = user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "Unknown";

  const tagsRaw = (formData.get("tags") as string | null) ?? "";
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const asset = await createAsset(DEV_TENANT_ID, user?.id ?? "unknown", {
    name: formData.get("name") as string,
    category: formData.get("category") as "Electronics" | "Furniture" | "Vehicles" | "Equipment" | "Tools" | "Other",
    brand: formData.get("brand") as string,
    model: formData.get("model") as string,
    serialNumber: formData.get("serialNumber") as string,
    barcode: formData.get("barcode") as string,
    status: "available",
    location: formData.get("location") as string,
    assignedTo: (formData.get("assignedTo") as string | null) || null,
    purchaseDate: new Date(formData.get("purchaseDate") as string),
    purchasePrice: formData.get("purchasePrice") as string,
    warrantyExpiry: new Date(formData.get("warrantyExpiry") as string),
    supplier: formData.get("supplier") as string,
    buyUrl: (formData.get("buyUrl") as string | null) || null,
    notes: (formData.get("notes") as string | null) || null,
    tags,
  });

  await logHistory(DEV_TENANT_ID, asset.id, userName, "created");

  redirect(`/assets/${asset.id}`);
}
