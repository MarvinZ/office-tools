import * as XLSX from "xlsx";

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

const HEADERS = [
  "empleado", "cedula", "salario", "feriados", "extras", "total",
  "ccss", "bcoPop", "cobrarEmpleados", "uniformes", "embargos",
  "viaticos", "asosolisa", "marchamos", "prestamos", "netoAPagar", "puesto",
];

export async function parsePayrollFromUrl(url: string): Promise<PayrollRow[]> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return parsePayrollBuffer(buffer);
}

export function parsePayrollBuffer(buffer: ArrayBuffer): PayrollRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // Data starts at row 5 (0-indexed: 4). Rows 1-4 are title + headers.
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: 4,
    header: HEADERS,
  });

  return raw
    .filter((r) => r.empleado && String(r.empleado).trim() !== "")
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
}
