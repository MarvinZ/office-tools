import type { PayrollRow } from "./parser";

const fmt = (n: number) =>
  n === 0 ? "—" : `₡${n.toLocaleString("es-CR")}`;

const row = (label: string, value: string, deduction = false) => `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#444;font-size:14px;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;${deduction ? "color:#dc2626;" : "color:#111;"}">${value}</td>
  </tr>`;

export function buildPayrollEmail(data: PayrollRow): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">

        <!-- Header -->
        <tr><td style="background:#111;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">OfficeTools</p>
          <p style="margin:4px 0 0;color:#aaa;font-size:13px;">Comprobante de pago</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:24px 32px 0;">
          <p style="margin:0;font-size:15px;color:#111;">Estimado(a) <strong>${data.empleado}</strong>,</p>
          <p style="margin:8px 0 0;font-size:14px;color:#666;">A continuación el detalle de su pago correspondiente al período.</p>
        </td></tr>

        <!-- Table -->
        <tr><td style="padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${row("Cédula", data.cedula)}
            ${row("Puesto", data.puesto)}
            ${row("Salario base", fmt(data.salario))}
            ${data.feriados ? row("Feriados", fmt(data.feriados)) : ""}
            ${data.extras ? row("Extras", fmt(data.extras)) : ""}
            ${row("Total bruto", fmt(data.total))}
            ${row("CCSS (9.67%)", `-${fmt(data.ccss)}`, true)}
            ${row("Bco Popular (1%)", `-${fmt(data.bcoPop)}`, true)}
            ${data.cobrarEmpleados ? row("Cobrar empleados", `-${fmt(data.cobrarEmpleados)}`, true) : ""}
            ${data.uniformes ? row("Uniformes", `-${fmt(data.uniformes)}`, true) : ""}
            ${data.embargos ? row("Embargos", `-${fmt(data.embargos)}`, true) : ""}
            ${data.viaticos ? row("Viáticos", fmt(data.viaticos)) : ""}
            ${data.asosolisa ? row("Asosolisa (0.05%)", `-${fmt(data.asosolisa)}`, true) : ""}
            ${data.marchamos ? row("Marchamos y otros", `-${fmt(data.marchamos)}`, true) : ""}
            ${data.prestamos ? row("Préstamos Asosolisa", `-${fmt(data.prestamos)}`, true) : ""}
            <tr>
              <td style="padding:16px 0 0;font-size:16px;font-weight:700;color:#111;">NETO A PAGAR</td>
              <td style="padding:16px 0 0;text-align:right;font-size:18px;font-weight:700;color:#16a34a;">${fmt(data.netoAPagar)}</td>
            </tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:0 32px 32px;">
          <p style="margin:0;font-size:12px;color:#aaa;">Generado automáticamente por OfficeTools. No responda a este correo.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
