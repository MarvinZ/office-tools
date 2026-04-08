"use server";

import { resend } from "@/lib/resend";
import { put, list } from "@vercel/blob";

export async function sendEmail(email: string) {
  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }

  const { error } = await resend.emails.send({
    from: "OfficeTools <onboarding@resend.dev>",
    to: email,
    subject: "Hi from OfficeTools!",
    html: "<p>Hi there! This is a message from <strong>OfficeTools</strong>. Just saying hello!</p>",
  });

  if (error) {
    console.error("Resend error:", error);
    return { error: error.message ?? "Failed to send email. Please try again." };
  }

  return { success: true };
}

export async function uploadFile(formData: FormData) {
  const file = formData.get("file") as File;

  if (!file || file.size === 0) {
    return { error: "No file provided." };
  }

  const blob = await put(`uploads/${file.name}`, file, {
    access: "public",
  });

  return { url: blob.url, name: file.name };
}

export async function listFiles() {
  const { blobs } = await list({ prefix: "uploads/" });

  return blobs.map((b) => ({
    url: b.url,
    name: b.pathname.replace("uploads/", ""),
    uploadedAt: b.uploadedAt,
  }));
}
