import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend";

// Dev-only scaffolding: sends mail to any address through our Resend account,
// so it must never be reachable in production.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const { email } = await req.json();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const { error } = await resend.emails.send({
    from: "OfficeTools <onboarding@resend.dev>",
    to: email,
    subject: "Hi from OfficeTools!",
    html: "<p>Hi there! This is a test message from <strong>OfficeTools</strong>.</p>",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
