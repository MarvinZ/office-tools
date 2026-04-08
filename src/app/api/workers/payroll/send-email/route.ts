import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { db } from "@/db";
import { payrollEmails, payrollBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resend } from "@/lib/resend";
import { buildPayrollEmail } from "@/lib/payroll/email-template";
import { updateEmailStatus } from "@/services/payroll/emails";
import { updateBatchStatus } from "@/services/payroll/batches";
import type { PayrollRow } from "@/lib/payroll/parser";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: NextRequest) {
  // Verify the request is from QStash
  const body = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";

  const isValid = await receiver.verify({ body, signature }).catch(() => false);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId } = JSON.parse(body) as { emailId: string };

  // Fetch the email record
  const [emailRecord] = await db
    .select()
    .from(payrollEmails)
    .where(eq(payrollEmails.id, emailId))
    .limit(1);

  if (!emailRecord) {
    return NextResponse.json({ error: "Email record not found" }, { status: 404 });
  }

  // Send the email
  const row = emailRecord.payload as unknown as PayrollRow;
  const { error } = await resend.emails.send({
    from: "OfficeTools <onboarding@resend.dev>",
    to: emailRecord.recipientEmail,
    subject: `Comprobante de pago — ${row.empleado}`,
    html: buildPayrollEmail(row),
  });

  if (error) {
    await updateEmailStatus(emailRecord.id, "failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await updateEmailStatus(emailRecord.id, "sent");

  // Check if all emails in the batch are done, update batch status
  const allEmails = await db
    .select()
    .from(payrollEmails)
    .where(eq(payrollEmails.batchId, emailRecord.batchId));

  const allDone = allEmails.every((e) => e.status === "sent" || e.status === "failed");

  if (allDone) {
    const anyFailed = allEmails.some((e) => e.status === "failed");
    const allFailed = allEmails.every((e) => e.status === "failed");
    await updateBatchStatus(
      emailRecord.batchId,
      allFailed ? "failed" : anyFailed ? "sent" : "sent"
    );
  }

  return NextResponse.json({ success: true });
}
