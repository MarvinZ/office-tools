"use server";

import { resend } from "@/lib/resend";
import { put, list, getDownloadUrl } from "@vercel/blob";
import * as XLSX from "xlsx";

// ── Email test ────────────────────────────────────────────────────────────────

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

// ── File upload ───────────────────────────────────────────────────────────────

export async function uploadFile(formData: FormData) {
  const file = formData.get("file") as File;

  if (!file || file.size === 0) {
    return { error: "No file provided." };
  }

  const blob = await put(`uploads/${file.name}`, file, { access: "public" });

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

// ── Payroll ───────────────────────────────────────────────────────────────────

// TODO: remove limit and hardcoded email once column is added to Excel
const DEV_LIMIT = 3;
const DEV_EMAIL = "marvinzzz@gmail.com";

export type PayrollRow = {
  empleado: string;
  cedula: string;
  salario: number;
  feriados: number;
  extras: number;
  total: number;
  ccss: number;
  bcoPop: number;
  cobrarEmpleados: number;
  uniformes: number;
  embargos: number;
  viaticos: number;
  asosolisa: number;
  marchamos: number;
  prestamos: number;
  netoAPagar: number;
  puesto: string;
};

export async function parsePayrollFile(fileUrl: string): Promise<{ rows?: PayrollRow[]; error?: string }> {
  const response = await fetch(fileUrl);
  const arrayBuffer = await response.arrayBuffer();

  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // Data starts at row 5 (index 4), headers at row 3
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: 4, // skip title + header rows, start at row 5
    header: ["empleado", "cedula", "salario", "feriados", "extras", "total", "ccss", "bcoPop", "cobrarEmpleados", "uniformes", "embargos", "viaticos", "asosolisa", "marchamos", "prestamos", "netoAPagar", "puesto"],
  });

  const rows: PayrollRow[] = raw
    .filter((r) => r.empleado && String(r.empleado).trim() !== "") // skip empty rows
    .slice(0, DEV_LIMIT) // TODO: remove limit
    .map((r) => ({
      empleado: String(r.empleado ?? ""),
      cedula: String(r.cedula ?? ""),
      salario: Number(r.salario) || 0,
      feriados: Number(r.feriados) || 0,
      extras: Number(r.extras) || 0,
      total: Number(r.total) || 0,
      ccss: Number(r.ccss) || 0,
      bcoPop: Number(r.bcoPop) || 0,
      cobrarEmpleados: Number(r.cobrarEmpleados) || 0,
      uniformes: Number(r.uniformes) || 0,
      embargos: Number(r.embargos) || 0,
      viaticos: Number(r.viaticos) || 0,
      asosolisa: Number(r.asosolisa) || 0,
      marchamos: Number(r.marchamos) || 0,
      prestamos: Number(r.prestamos) || 0,
      netoAPagar: Number(r.netoAPagar) || 0,
      puesto: String(r.puesto ?? ""),
    }));

  return { rows };
}

export async function sendPayrollEmails(rows: PayrollRow[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const { error } = await resend.emails.send({
      from: "OfficeTools <onboarding@resend.dev>",
      to: DEV_EMAIL, // TODO: replace with row.email once column exists
      subject: `Comprobante de pago — ${row.empleado}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="margin-bottom: 4px;">Comprobante de Pago</h2>
          <p style="color: #666; margin-top: 0;">Planilla de salarios</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;"><strong>Empleado</strong></td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">${row.empleado}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;">Cédula</td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">${row.cedula}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;">Puesto</td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">${row.puesto}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;">Salario Base</td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">₡${row.salario.toLocaleString("es-CR")}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;">Feriados</td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">₡${row.feriados.toLocaleString("es-CR")}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;">Extras</td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">₡${row.extras.toLocaleString("es-CR")}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;">Total Bruto</td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">₡${row.total.toLocaleString("es-CR")}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee; color: #e00;">CCSS (9.67%)</td><td style="padding: 6px 0; border-bottom: 1px solid #eee; color: #e00;">-₡${row.ccss.toLocaleString("es-CR")}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee; color: #e00;">Bco Popular (1%)</td><td style="padding: 6px 0; border-bottom: 1px solid #eee; color: #e00;">-₡${row.bcoPop.toLocaleString("es-CR")}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee; color: #e00;">Embargos</td><td style="padding: 6px 0; border-bottom: 1px solid #eee; color: #e00;">-₡${row.embargos.toLocaleString("es-CR")}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee; color: #e00;">Marchamos y otros</td><td style="padding: 6px 0; border-bottom: 1px solid #eee; color: #e00;">-₡${row.marchamos.toLocaleString("es-CR")}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold; font-size: 16px;">NETO A PAGAR</td><td style="padding: 6px 0; font-weight: bold; font-size: 16px; color: #16a34a;">₡${row.netoAPagar.toLocaleString("es-CR")}</td></tr>
          </table>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">Generado por OfficeTools</p>
        </div>
      `,
    });

    if (error) {
      console.error(`Failed to send email for ${row.empleado}:`, error);
      failed++;
    } else {
      sent++;
    }
  }

  return { sent, failed };
}
