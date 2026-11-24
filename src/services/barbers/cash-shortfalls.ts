import { and, asc, eq, gte, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/db";
import { barberClosingFiles } from "@/db/schema";
import { normalizeText } from "@/lib/barbers/closing-import/normalize";
import type { ClosingShift } from "@/lib/barbers/closing-import/parse-cierre-general";

/**
 * Cash differences per shift, from the imported daily closings (CIERRE
 * GENERAL row 25). Brayan (Nov 2026): a confirmed shortfall is charged to the
 * cashier of that shift, with no second approval, in the payment of the same
 * fortnight (shortfalls on the 5th and 11th come off the payment on the 15th).
 * Cashier pay itself is outside the system: this is the report to apply it.
 */

export type CashDifferenceRow = {
  date: string;
  shift: 1 | 2;
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
  totalShortfall: number;
};

export async function getCashDifferences(tenantId: string, from: string, to: string): Promise<CashDifferenceReport> {
  const files = await db
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
    .orderBy(asc(barberClosingFiles.businessDate));

  const rows: CashDifferenceRow[] = [];
  for (const f of files) {
    const shifts = ((f.summary ?? {}) as { shifts?: ClosingShift[] }).shifts ?? [];
    for (const s of shifts) {
      if (s.difference === 0) continue;
      rows.push({ date: f.businessDate, ...s });
    }
  }

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
    totalShortfall: byCashier.reduce((n, c) => n + c.shortfall, 0),
  };
}
