import * as XLSX from "xlsx";
import { normalizeAmount, normalizeText } from "./normalize";

/**
 * Parser for the CIERRE GENERAL sheet of a daily closing, per the NOURA spec
 * §4.4 cell map, confirmed against the real November 2026 files:
 *
 *   I5 / K5    cashier of shift 1 / shift 2
 *   C8:D8      system total per shift
 *   G17:L24    cash outflows ("salidas"): G who it was given to, J concept, L amount
 *   G30:L34    services on credit: G professional, I detail, J client, L amount
 *   G40:L45    products on credit: G product, H qty, I professional, K vendor, L amount
 *
 * Structural only, like parseFacturacion: names are kept as written and
 * matched to people by the import planner. Each section stops at its TOTAL row.
 */

export const CIERRE_GENERAL_SHEET = "CIERRE GENERAL";

export type ClosingOutflow = { sourceRow: number; who: string; concept: string; amount: number };
export type ClosingServiceOnCredit = { sourceRow: number; performer: string; detail: string; client: string; amount: number };
export type ClosingProductOnCredit = {
  sourceRow: number;
  product: string;
  quantity: number | null;
  person: string;
  vendor: string;
  amount: number;
};

export type CierreGeneral = {
  cashiers: { shift1: string; shift2: string };
  systemTotal: number | null;
  outflows: ClosingOutflow[];
  servicesOnCredit: ClosingServiceOnCredit[];
  productsOnCredit: ClosingProductOnCredit[];
};

export type CierreGeneralParseResult =
  | { ok: true; data: CierreGeneral }
  | { ok: false; error: "sheet_not_found"; sheetNames: string[] };

function text(ws: XLSX.WorkSheet, addr: string): string {
  const v = ws[addr]?.v;
  return v == null ? "" : String(v).trim();
}

function amount(ws: XLSX.WorkSheet, addr: string): number | null {
  return normalizeAmount(ws[addr]?.v);
}

/** Rows first..last of a section, stopping at a "TOTAL" label in `labelCol`. */
function* sectionRows(ws: XLSX.WorkSheet, first: number, last: number, labelCol: string) {
  for (let r = first; r <= last; r++) {
    if (normalizeText(text(ws, `${labelCol}${r}`)).startsWith("TOTAL")) return;
    yield r;
  }
}

export function parseCierreGeneral(workbook: XLSX.WorkBook): CierreGeneralParseResult {
  const name = workbook.SheetNames.find((n) => normalizeText(n) === CIERRE_GENERAL_SHEET);
  if (!name) return { ok: false, error: "sheet_not_found", sheetNames: workbook.SheetNames };
  const ws = workbook.Sheets[name];

  const outflows: ClosingOutflow[] = [];
  for (const r of sectionRows(ws, 17, 24, "G")) {
    const value = amount(ws, `L${r}`);
    if (!value) continue;
    outflows.push({ sourceRow: r, who: text(ws, `G${r}`), concept: text(ws, `J${r}`), amount: value });
  }

  const servicesOnCredit: ClosingServiceOnCredit[] = [];
  for (const r of sectionRows(ws, 30, 34, "G")) {
    const value = amount(ws, `L${r}`);
    if (!value) continue;
    servicesOnCredit.push({
      sourceRow: r,
      performer: text(ws, `G${r}`),
      detail: text(ws, `I${r}`),
      client: text(ws, `J${r}`),
      amount: value,
    });
  }

  const productsOnCredit: ClosingProductOnCredit[] = [];
  for (const r of sectionRows(ws, 40, 45, "G")) {
    const value = amount(ws, `L${r}`);
    if (!value) continue;
    productsOnCredit.push({
      sourceRow: r,
      product: text(ws, `G${r}`),
      quantity: amount(ws, `H${r}`),
      person: text(ws, `I${r}`),
      vendor: text(ws, `K${r}`),
      amount: value,
    });
  }

  const shift1 = amount(ws, "C8");
  const shift2 = amount(ws, "D8");
  return {
    ok: true,
    data: {
      cashiers: { shift1: text(ws, "I5"), shift2: text(ws, "K5") },
      systemTotal: shift1 == null && shift2 == null ? null : (shift1 ?? 0) + (shift2 ?? 0),
      outflows,
      servicesOnCredit,
      productsOnCredit,
    },
  };
}
