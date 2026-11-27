import Decimal from "decimal.js";

/**
 * The admin panel's business rules (NOURA Módulo 1: "Panel general del
 * administrador"). Pure: the services layer loads the figures, everything
 * here is deterministic and unit tested (panel.test.ts).
 *
 * "Sales" throughout = what customers actually paid, IVA included: normal
 * services plus products sold to customers. Voided, courtesy and warranty
 * services are left out because no money came in for them. (NOURA hasn't
 * defined "ventas netas" yet; this is the default to confirm with them.)
 */

const ZERO = new Decimal(0);
const cents = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
const pct = (d: Decimal) => d.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber();

// ── Calendar ──────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM" of a YYYY-MM-DD date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Valid "YYYY-MM" or null. */
export function parseMonthKey(key: string | null | undefined): string | null {
  const m = key ? /^(\d{4})-(\d{2})$/.exec(key) : null;
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? key! : null;
}

/** First and last day of a "YYYY-MM" month, as YYYY-MM-DD. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad2(lastDay)}` };
}

/** The month `step` months away from "YYYY-MM". */
export function shiftMonth(month: string, step: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + step, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/** Weekday of a YYYY-MM-DD calendar day, 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

export function previousDay(date: string): string {
  return addDays(date, -1);
}

/** Days from `from` to `to` (inclusive) the shop opens. 0 when from > to. */
export function operatingDaysBetween(from: string, to: string, closedWeekdays: number[]): number {
  const closed = new Set(closedWeekdays);
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (!closed.has(weekdayOf(d))) n++;
  return n;
}

export function isOperatingDay(date: string, closedWeekdays: number[]): boolean {
  return !closedWeekdays.includes(weekdayOf(date));
}

// ── Goal and projection (§8, CA 04) ─────────────────────────────────────────

export type GoalProgress = {
  goal: number;
  sales: number;
  /** sales ÷ goal × 100; above 100 once the goal is passed (the real %). */
  percent: number;
  /** max(goal − sales, 0). */
  remaining: number;
  reached: boolean;
  /** Operating days left in the period, today included. */
  daysRemaining: number;
  /**
   * remaining ÷ daysRemaining. 0 once reached; null when there's still an
   * amount left but no operating day to sell it in.
   */
  requiredDaily: number | null;
};

/** Progress toward a goal; null when no (positive) goal is set. */
export function goalProgress(
  sales: Decimal.Value,
  goal: Decimal.Value | null | undefined,
  daysRemaining: number
): GoalProgress | null {
  if (goal == null) return null;
  const g = new Decimal(goal);
  if (g.lte(0)) return null;
  const s = new Decimal(sales);
  const remaining = Decimal.max(ZERO, g.minus(s));
  const reached = remaining.isZero();
  return {
    goal: cents(g),
    sales: cents(s),
    percent: pct(s.div(g).times(100)),
    remaining: cents(remaining),
    reached,
    daysRemaining,
    requiredDaily: reached ? 0 : daysRemaining > 0 ? cents(remaining.div(daysRemaining)) : null,
  };
}

// ── Period comparison (§7, CA 05/06) ────────────────────────────────────────

export type Comparison = {
  current: number;
  base: number;
  diff: number;
  /** % change against the base; null = "Sin datos comparables" (base is 0). */
  percent: number | null;
};

export function compare(current: Decimal.Value, base: Decimal.Value): Comparison {
  const c = new Decimal(current);
  const b = new Decimal(base);
  return {
    current: cents(c),
    base: cents(b),
    diff: cents(c.minus(b)),
    percent: b.isZero() ? null : pct(c.minus(b).div(b.abs()).times(100)),
  };
}

// ── Header ──────────────────────────────────────────────────────────────────

export type Greeting = "morning" | "afternoon" | "evening";

/** Buenos días 5:00–11:59, buenas tardes 12:00–18:59, buenas noches otherwise. */
export function greetingFor(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 19) return "afternoon";
  return "evening";
}

/** Costa Rica is UTC−6 all year: Date#getTimezoneOffset() returns 360 there. */
export const COSTA_RICA_OFFSET_MINUTES = 360;

// ── Message of the day (§4) ─────────────────────────────────────────────────

export type DayMessage =
  | { key: "closedToday" }
  | { key: "noSalesYet" }
  | { key: "dailyGoalReached" }
  | { key: "dailyGoalRemaining"; amount: number }
  | { key: "salesSoFar"; amount: number };

export function dayMessage(input: {
  operatingToday: boolean;
  salesToday: number;
  daily: GoalProgress | null;
}): DayMessage {
  if (input.salesToday === 0) return input.operatingToday ? { key: "noSalesYet" } : { key: "closedToday" };
  if (input.daily?.reached) return { key: "dailyGoalReached" };
  if (input.daily) return { key: "dailyGoalRemaining", amount: input.daily.remaining };
  return { key: "salesSoFar", amount: input.salesToday };
}

// ── Recommendations (§9) ────────────────────────────────────────────────────

export type RecommendationCategory = "opportunity" | "alert" | "followUp" | "info";

export type Recommendation = {
  /** Stable id including its period, so a decision applies to that period only. */
  key: string;
  category: RecommendationCategory;
  /** Translation key under barbers.panel.recs, plus the values it shows. */
  code: "registerClosingPending" | "fortnightUnclosed" | "commissionsPending" | "goalBehind" | "goalReached" | "noSalesYesterday";
  values: Record<string, string | number>;
  /** Where "Revisar" takes the admin. Recommendations never act by themselves. */
  href: string;
};

export type RecommendationFacts = {
  today: string;
  /** Location filter of the panel ("all" or a location id), part of each key. */
  scope: string;
  /** The fortnight before the current one: its key, last day and whether it's closed. */
  previousFortnight: { key: string; to: string; closed: boolean };
  /** Product commissions still unpaid from sales before the current fortnight. */
  pendingCommissions: { count: number; amount: number; before: string };
  /** Month to date vs. the monthly goal; null when no goal. */
  month: { key: string; progress: GoalProgress | null; elapsedOperatingDays: number; totalOperatingDays: number };
  /** Yesterday, when it was an operating day: locations with no sales at all. */
  yesterday: { date: string; operating: boolean; locationsWithoutSales: { id: string; name: string }[] };
  /** Register shifts left open from an earlier day (§13 "Cierre pendiente"). */
  pendingClosings?: { shiftId: string; date: string; shiftNumber: number; locationId: string; locationName: string }[];
};

/** How far behind the expected pace (as a share of the goal) counts as "behind". */
const BEHIND_PACE = 0.1;

/**
 * Turns the facts into recommendations, most urgent first. Each explains what
 * was detected (values) and offers a place to act (href); none executes
 * anything (§9 Confirmación, CA 09).
 */
export function buildRecommendations(f: RecommendationFacts): Recommendation[] {
  const out: Recommendation[] = [];

  for (const s of f.pendingClosings ?? []) {
    out.push({
      key: `registerClosingPending:${s.shiftId}`,
      category: "alert",
      code: "registerClosingPending",
      values: { date: s.date, shift: s.shiftNumber, location: s.locationName },
      href: `/barbers/register?locationId=${s.locationId}`,
    });
  }

  if (!f.previousFortnight.closed && f.previousFortnight.to < f.today) {
    out.push({
      key: `fortnightUnclosed:${f.previousFortnight.key}`,
      category: "alert",
      code: "fortnightUnclosed",
      values: { period: f.previousFortnight.key },
      href: `/barbers/settlements?period=${f.previousFortnight.key}`,
    });
  }

  const p = f.month.progress;
  if (p && p.reached) {
    out.push({
      key: `goalReached:${f.month.key}:${f.scope}`,
      category: "info",
      code: "goalReached",
      values: { month: f.month.key, percent: p.percent, goal: p.goal },
      href: `/barbers/panel/detail?month=${f.month.key}&locationId=${f.scope}`,
    });
  } else if (p && f.month.totalOperatingDays > 0 && f.month.elapsedOperatingDays > 0) {
    const expected = new Decimal(p.goal).times(f.month.elapsedOperatingDays).div(f.month.totalOperatingDays);
    if (new Decimal(p.sales).lt(expected.minus(new Decimal(p.goal).times(BEHIND_PACE)))) {
      out.push({
        key: `goalBehind:${f.month.key}:${f.scope}`,
        category: "alert",
        code: "goalBehind",
        values: { month: f.month.key, sales: p.sales, expected: cents(expected), requiredDaily: p.requiredDaily ?? p.remaining },
        href: `/barbers/panel/detail?month=${f.month.key}&locationId=${f.scope}`,
      });
    }
  }

  if (f.pendingCommissions.count > 0) {
    out.push({
      key: `commissionsPending:${f.pendingCommissions.before}`,
      category: "followUp",
      code: "commissionsPending",
      values: { count: f.pendingCommissions.count, amount: f.pendingCommissions.amount },
      href: "/barbers/product-closing",
    });
  }

  if (f.yesterday.operating) {
    for (const loc of f.yesterday.locationsWithoutSales) {
      out.push({
        key: `noSalesYesterday:${f.yesterday.date}:${loc.id}`,
        category: "followUp",
        code: "noSalesYesterday",
        values: { date: f.yesterday.date, location: loc.name },
        href: `/barbers/panel/detail?from=${f.yesterday.date}&to=${f.yesterday.date}&locationId=${loc.id}`,
      });
    }
  }

  return out;
}
