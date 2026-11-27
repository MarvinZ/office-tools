import { and, asc, eq, gte, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/db";
import { barberClosingFiles } from "@/db/schema";
import { normalizeText } from "@/lib/barbers/closing-import/normalize";
import type { ClosingShift } from "@/lib/barbers/closing-import/parse-cierre-general";
import { listShiftDifferences } from "./cash-register";

/**
 * Cash differences per shift: from the imported daily closings (CIERRE
 * GENERAL row 25) and from shifts closed in the app's cash register. Brayan (Nov 2026): a confirmed shortfall is charged to the
 * cashier of that shift, with no second approval, in the payment of the same
 * fortnight (shortfalls on the 5th and 11th come off the payment on the 15th).
 * Cashier pay itself is outside the system: this is the report to apply it.
 */

export type CashDifferenceRow = {
  date: string;
  shift: number;
  /** Set for shifts closed in the app (links to their closing). */
  shiftId?: string;
  cashier: string;
  system: number;
  counted: number;
  difference: number; // > 0 shortfall, < 0 surplus
};

export type CashierTotal = { cashier: string; shortfall: number; surplus: number; days: number };

export type CashDifferenceReport = {
  rows: CashDifferenceRow[];
  byCashier: CashierTotal[];
  daysImported: number;
  shiftsClosed: number; // in the app
  totalShortfall: number;
};

export async function getCashDifferences(tenantId: string, from: string, to: string): Promise<CashDifferenceReport> {
  const [files, app] = await Promise.all([
    db
      .select({ businessDate: barberClosingFiles.businessDate, summary: barberClosingFiles.summary })
      .from(barberClosingFiles)
      .where(
        and(
          eq(barberClosingFiles.tenantId, tenantId),
          eq(barberClosingFiles.status, "imported"),
          gte(barberClosingFiles.businessDate, from),
          lte(barberClosingFiles.businessDate, to)
        )
      )
      .orderBy(asc(barberClosingFiles.businessDate)),
    listShiftDifferences(tenantId, from, to),
  ]);

  const rows: CashDifferenceRow[] = [];
  for (const f of files) {
    const shifts = ((f.summary ?? {}) as { shifts?: ClosingShift[] }).shifts ?? [];
    for (const s of shifts) {
      if (s.difference === 0) continue;
      rows.push({ date: f.businessDate, ...s });
    }
  }
  for (const s of app.rows) {
    rows.push({
      date: s.businessDate,
      shift: s.shiftNumber,
      shiftId: s.id,
      cashier: s.cashierName,
      system: Number(s.expectedTotal ?? 0),
      counted: Number(s.countedTotal ?? 0),
      difference: Number(s.difference ?? 0),
    });
  }
  rows.sort((a, b) => (a.date === b.date ? a.shift - b.shift : a.date.localeCompare(b.date)));

  // Group cashiers by normalized name ("Lesly" / "LESLY "), showing the first spelling.
  const totals = new Map<string, { cashier: string; shortfall: Decimal; surplus: Decimal; dates: Set<string> }>();
  for (const r of rows) {
    const key = normalizeText(r.cashier) || "—";
    const t = totals.get(key) ?? { cashier: r.cashier || "—", shortfall: new Decimal(0), surplus: new Decimal(0), dates: new Set<string>() };
    if (r.difference > 0) t.shortfall = t.shortfall.plus(r.difference);
    else t.surplus = t.surplus.plus(-r.difference);
    t.dates.add(r.date);
    totals.set(key, t);
  }
  const byCashier = [...totals.values()].map((t) => ({
    cashier: t.cashier,
    shortfall: t.shortfall.toNumber(),
    surplus: t.surplus.toNumber(),
    days: t.dates.size,
  }));
  return {
    rows,
    byCashier,
    daysImported: files.length,
    shiftsClosed: app.closedCount,
    totalShortfall: byCashier.reduce((n, c) => n + c.shortfall, 0),
  };
}
