import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  dateFromClosingFileName,
  matchPerson,
  normalizeAmount,
  normalizePaymentMethod,
  normalizeRate,
} from "./normalize";
import { parseFacturacion } from "./parse-facturacion";

describe("normalizers", () => {
  it("payment methods", () => {
    expect(normalizePaymentMethod("Efectivo")).toBe("EFECTIVO");
    expect(normalizePaymentMethod("sinpe móvil")).toBe("SINPE MOVIL");
    expect(normalizePaymentMethod("TARJETA")).toBe("TARJETA");
    expect(normalizePaymentMethod("crédito")).toBe("CREDITO");
    expect(normalizePaymentMethod("")).toBe("PENDIENTE");
    expect(normalizePaymentMethod("???")).toBe("PENDIENTE");
  });

  it("rates: 50, 0.5 and '50%' all mean 50%", () => {
    expect(normalizeRate(50)).toBe(0.5);
    expect(normalizeRate(0.65)).toBe(0.65);
    expect(normalizeRate("60%")).toBe(0.6);
    expect(normalizeRate(100)).toBe(1);
    expect(normalizeRate("")).toBeNull();
    expect(normalizeRate(250)).toBeNull();
  });

  it("amounts in either locale", () => {
    expect(normalizeAmount(11300)).toBe(11300);
    expect(normalizeAmount("₡11.300")).toBe(11300);
    expect(normalizeAmount("11,300.50")).toBe(11300.5);
    expect(normalizeAmount("11.300,50")).toBe(11300.5);
    expect(normalizeAmount("")).toBeNull();
  });

  it("matches aliases exactly, never guesses", () => {
    const people = [
      { id: "brayan", names: ["Brayan", "Bryan"] },
      { id: "maicol", names: ["Maicol", "Michael"] },
    ];
    expect(matchPerson("bryan ", people)).toBe("brayan");
    expect(matchPerson("MICHAEL", people)).toBe("maicol");
    expect(matchPerson("Bray", people)).toBeNull();
  });

  it("file name date (spec §4.2)", () => {
    expect(dateFromClosingFileName("CIERRE 29-10-2026.xlsx")).toBe("2026-10-29");
    expect(dateFromClosingFileName("CIERRE 1-9-2026.xlsx")).toBe("2026-09-01");
    expect(dateFromClosingFileName("CIERRE 31-02-2026.xlsx")).toBeNull();
    expect(dateFromClosingFileName("cierre.xlsx")).toBeNull();
  });
});

function workbookWithFacturacion(rows: unknown[][]): XLSX.WorkBook {
  // Rows 1–5 are template headers; data starts on row 6.
  const aoa = [["CIERRE"], [], [], [], ["#", "HORA", "PROFESIONAL", "SERVICIO", "MONTO", "%", "METODO"], ...rows];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "CIERRE GENERAL");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "FACTURACION");
  return wb;
}

describe("parseFacturacion", () => {
  it("reads rows from row 6, keeping source row and raw text", () => {
    const wb = workbookWithFacturacion([
      [1, 0.5, "Bryan", "Corte", 11300, 50, "Tarjeta"],
      [2, "14:30", "Zoe", "Manicura", "₡6.500", "65%", "sinpe"],
    ]);
    const result = parseFacturacion(wb);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      sourceRow: 6, ticketId: "1", time: "12:00", personRaw: "Bryan", amount: 11300, rate: 0.5, method: "TARJETA", issues: [],
    });
    expect(result.rows[1]).toMatchObject({ sourceRow: 7, time: "14:30", amount: 6500, rate: 0.65, method: "SINPE MOVIL" });
  });

  it("skips blank and TOTAL rows but keeps reading past them (no fixed last row)", () => {
    const wb = workbookWithFacturacion([
      [1, null, "Maicol", "Corte", 10000, 100, "Efectivo"],
      [],
      [null, null, "TOTAL", null, 10000, null, null],
      [3, null, "Jorge", "Barba", 5000, 50, "Efectivo"],
    ]);
    const result = parseFacturacion(wb);
    if (!result.ok) throw new Error("expected ok");
    expect(result.rows.map((r) => r.sourceRow)).toEqual([6, 9]);
  });

  it("flags problems instead of dropping rows", () => {
    const wb = workbookWithFacturacion([[1, null, "", "Corte", null, 300, ""]]);
    const result = parseFacturacion(wb);
    if (!result.ok) throw new Error("expected ok");
    expect(result.rows[0].issues).toEqual(["missing_person", "missing_amount", "invalid_rate", "pending_method"]);
  });

  it("reports a missing FACTURACION sheet", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), "Hoja1");
    expect(parseFacturacion(wb)).toEqual({ ok: false, error: "sheet_not_found", sheetNames: ["Hoja1"] });
  });
});
