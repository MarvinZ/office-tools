"use server";

import { resend } from "@/lib/resend";

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
