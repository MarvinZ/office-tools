import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildSettlementWorkbook, settlementDocLines, type WorkbookBarber, type WorkbookLabels } from "./settlement-document";
import type { BarberSettlement } from "./settlement";

const ZERO: BarberSettlement = {
  serviceCount: 0, daysWorked: 0, grossCharged: 0, serviceIncome: 0, addition: 0, cardFee: 0, maintenance: 0,
  productCredit: 0, vales: 0, totalExpenses: 0, net: 0, ivaBase: 0, iva: 0, ivaPaid: 0, ivaInformative: false,
  invoice: 0, tips: 0, transfer: 0, shortfall: 0,
};

function barber(id: string, name: string, s: Partial<BarberSettlement>): WorkbookBarber {
  return { ...ZERO, ...s, barberId: id, barberName: name, idNumber: null, iban: null };
}

const labels: WorkbookLabels = {
  summarySheet: "Summary",
  transfersSheet: "Transfers",
  title: "T",
  status: "S",
  summaryHeaders: ["h"],
  total: "Total",
  transferHeaders: ["a", "b", "c", "d"],
  servicesLabel: "Services",
  daysLabel: "Days",
  idNumberLabel: "ID",
  ibanLabel: "IBAN",
  line: (k) => k,
  shortfall: (n) => `short ${n}`,
};

describe("settlementDocLines", () => {
  it("omits a zero addition and ends on the transfer", () => {
    const lines = settlementDocLines({ ...ZERO, transfer: 100 });
    expect(lines.map((l) => l.key)).not.toContain("addition");
    expect(lines.at(-1)).toMatchObject({ key: "transfer", amount: 100, strong: true });
  });

  it("marks informative IVA as not added", () => {
    expect(settlementDocLines({ ...ZERO, iva: 13, ivaInformative: true }).find((l) => l.key === "iva")?.sign).toBe("=");
    expect(settlementDocLines({ ...ZERO, iva: 13 }).find((l) => l.key === "iva")?.sign).toBe("+");
  });
});

describe("buildSettlementWorkbook", () => {
  const totals = { serviceCount: 0, serviceIncome: 0, addition: 0, cardFee: 0, maintenance: 0, productCredit: 0,
    vales: 0, net: 0, iva: 0, invoice: 0, tips: 0, transfer: 0 };

  it("has summary, transfers and one sheet per barber with safe unique names", () => {
    const wb = buildSettlementWorkbook(
      [barber("1", "Ana", { transfer: 50 }), barber("2", "Ana", {}), barber("3", "A/B:C", {})],
      totals,
      labels
    );
    expect(wb.SheetNames).toEqual(["Summary", "Transfers", "Ana", "Ana (2)", "A B C"]);
  });

  it("lists only barbers owed money on the transfer sheet", () => {
    const wb = buildSettlementWorkbook(
      [barber("1", "Ana", { transfer: 50 }), barber("2", "Bea", { transfer: 0, shortfall: 20 })],
      totals,
      labels
    );
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Transfers, { header: 1 });
    expect(rows.slice(3)).toEqual([["Ana", "", "", 50], ["Total", "", "", 50]]);
  });
});
