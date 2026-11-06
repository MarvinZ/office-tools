import * as XLSX from "xlsx";
import type { BarberSettlement } from "./settlement";

/**
 * The individual settlement ("liquidación individual", spec §10.1) as an
 * ordered list of lines. Shared by the printable page and the Excel export so
 * both always show the same concepts in the same order. Labels are i18n keys
 * under barbers.settlementDoc; callers translate.
 */

export type SettlementDocLineKey =
  | "serviceIncome"
  | "addition"
  | "cardFee"
  | "maintenance"
  | "productCredit"
  | "vales"
  | "net"
  | "iva"
  | "invoice"
  | "tips"
  | "transfer";

export type SettlementDocLine = {
  key: SettlementDocLineKey;
  amount: number;
  /** "+" adds, "−" deducts, "=" is a subtotal/result. */
  sign: "+" | "−" | "=";
  strong?: boolean;
};

export function settlementDocLines(s: BarberSettlement): SettlementDocLine[] {
  const lines: SettlementDocLine[] = [{ key: "serviceIncome", amount: s.serviceIncome, sign: "+" }];
  if (s.addition !== 0) lines.push({ key: "addition", amount: s.addition, sign: "+" });
  lines.push(
    { key: "cardFee", amount: s.cardFee, sign: "−" },
    { key: "maintenance", amount: s.maintenance, sign: "−" },
    { key: "productCredit", amount: s.productCredit, sign: "−" },
    { key: "vales", amount: s.vales, sign: "−" },
    { key: "net", amount: s.net, sign: "=" },
    // Informative IVA is shown but not added — the invoice line makes that visible.
    { key: "iva", amount: s.iva, sign: s.ivaInformative ? "=" : "+" },
    { key: "invoice", amount: s.invoice, sign: "=" },
    { key: "tips", amount: s.tips, sign: "+" },
    { key: "transfer", amount: s.transfer, sign: "=", strong: true }
  );
  return lines;
}

// ── Excel workbook ───────────────────────────────────────────────────────────

export type WorkbookBarber = BarberSettlement & {
  barberId: string;
  barberName: string;
  idNumber: string | null;
  iban: string | null;
};

export type WorkbookLabels = {
  summarySheet: string;
  transfersSheet: string;
  title: string; // "Settlements · 1st fortnight · 01/10/2026 – 15/10/2026"
  status: string; // "Closed 16/10/2026" or "Preliminary — not closed"
  summaryHeaders: string[]; // barber, services, days, then one per SUMMARY_KEYS
  total: string;
  transferHeaders: [string, string, string, string]; // barber, id number, IBAN, amount
  servicesLabel: string;
  daysLabel: string;
  idNumberLabel: string;
  ibanLabel: string;
  line: (key: SettlementDocLineKey) => string;
  shortfall: (amount: number) => string;
};

const SUMMARY_KEYS = [
  "serviceIncome", "addition", "cardFee", "maintenance", "productCredit", "vales",
  "net", "iva", "invoice", "tips", "transfer",
] as const;

const MONEY = "#,##0.00";

function formatMoneyCells(ws: XLSX.WorkSheet, firstRow: number, lastRow: number, cols: number[]) {
  for (let r = firstRow; r <= lastRow; r++) {
    for (const c of cols) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "number") cell.z = MONEY;
    }
  }
}

/** Excel sheet names: ≤31 chars, no []:*?/\, unique within the workbook. */
function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * One workbook per fortnight: a summary sheet (all barbers + totals), a bank
 * transfer sheet (who gets paid how much, where) and one sheet per barber with
 * their individual settlement.
 */
export function buildSettlementWorkbook(
  rows: WorkbookBarber[],
  totals: Record<(typeof SUMMARY_KEYS)[number] | "serviceCount", number>,
  labels: WorkbookLabels
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  // Summary
  const header = [labels.title, "", labels.status];
  const summary: (string | number)[][] = [
    header,
    [],
    labels.summaryHeaders,
    ...rows.map((r) => [r.barberName, r.serviceCount, r.daysWorked, ...SUMMARY_KEYS.map((k) => r[k])]),
    [labels.total, totals.serviceCount, "", ...SUMMARY_KEYS.map((k) => totals[k])],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summary);
  formatMoneyCells(summaryWs, 3, summary.length - 1, SUMMARY_KEYS.map((_, i) => i + 3));
  summaryWs["!cols"] = [{ wch: 24 }, { wch: 9 }, { wch: 7 }, ...SUMMARY_KEYS.map(() => ({ wch: 13 }))];
  XLSX.utils.book_append_sheet(wb, summaryWs, sheetName(labels.summarySheet, used));

  // Bank transfers — only barbers actually owed money.
  const payees = rows.filter((r) => r.transfer > 0);
  const transfers: (string | number)[][] = [
    [labels.title, "", labels.status],
    [],
    labels.transferHeaders,
    ...payees.map((r) => [r.barberName, r.idNumber ?? "", r.iban ?? "", r.transfer]),
    [labels.total, "", "", payees.reduce((n, r) => n + r.transfer, 0)],
  ];
  const transfersWs = XLSX.utils.aoa_to_sheet(transfers);
  formatMoneyCells(transfersWs, 3, transfers.length - 1, [3]);
  transfersWs["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 28 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, transfersWs, sheetName(labels.transfersSheet, used));

  // One sheet per barber
  for (const r of rows) {
    const aoa: (string | number)[][] = [
      [r.barberName],
      [labels.title],
      [labels.status],
      [],
      [labels.idNumberLabel, r.idNumber ?? ""],
      [labels.ibanLabel, r.iban ?? ""],
      [labels.servicesLabel, r.serviceCount],
      [labels.daysLabel, r.daysWorked],
      [],
      ...settlementDocLines(r).map((l) => [`${l.sign} ${labels.line(l.key)}`, l.amount]),
    ];
    if (r.shortfall > 0) aoa.push([], [labels.shortfall(r.shortfall)]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    formatMoneyCells(ws, 9, aoa.length - 1, [1]);
    ws["!cols"] = [{ wch: 36 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName(r.barberName, used));
  }

  return wb;
}
