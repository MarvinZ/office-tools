import { describe, expect, it } from "vitest";
import {
  buildRecommendations,
  compare,
  dayMessage,
  goalProgress,
  greetingFor,
  monthRange,
  operatingDaysBetween,
  parseMonthKey,
  shiftMonth,
  weekdayOf,
  type RecommendationFacts,
} from "./panel";

describe("calendar helpers", () => {
  it("month ranges, including February in a leap year", () => {
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("parses month keys", () => {
    expect(parseMonthKey("2026-11")).toBe("2026-11");
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("2026-1")).toBeNull();
    expect(parseMonthKey(undefined)).toBeNull();
  });

  it("weekdays and operating days", () => {
    expect(weekdayOf("2026-11-29")).toBe(0); // a Sunday
    // 27–30 Nov 2026: Fri, Sat, Sun, Mon. Closed on Sundays → 3 days.
    expect(operatingDaysBetween("2026-11-27", "2026-11-30", [0])).toBe(3);
    expect(operatingDaysBetween("2026-11-27", "2026-11-30", [])).toBe(4);
    expect(operatingDaysBetween("2026-12-01", "2026-11-30", [])).toBe(0);
  });
});

describe("goal progress (§8, CA 04)", () => {
  it("percent, remaining and required daily sales", () => {
    const p = goalProgress(3_000_000, 5_000_000, 4)!;
    expect(p.percent).toBe(60);
    expect(p.remaining).toBe(2_000_000);
    expect(p.requiredDaily).toBe(500_000);
    expect(p.reached).toBe(false);
  });

  it("a passed goal shows the real percentage and nothing left", () => {
    const p = goalProgress(5_500_000, 5_000_000, 4)!;
    expect(p.percent).toBe(110);
    expect(p.remaining).toBe(0);
    expect(p.requiredDaily).toBe(0);
    expect(p.reached).toBe(true);
  });

  it("no operating days left with an amount still due → no daily figure", () => {
    expect(goalProgress(100, 1000, 0)!.requiredDaily).toBeNull();
  });

  it("no goal, or a zero goal, means no progress to show", () => {
    expect(goalProgress(100, null, 3)).toBeNull();
    expect(goalProgress(100, 0, 3)).toBeNull();
  });

  it("exact decimals", () => {
    expect(goalProgress(0, 1000, 3)!.requiredDaily).toBe(333.33);
  });
});

describe("comparison (§7, CA 06)", () => {
  it("difference and percentage", () => {
    expect(compare(1200, 1000)).toEqual({ current: 1200, base: 1000, diff: 200, percent: 20 });
    expect(compare(800, 1000).percent).toBe(-20);
  });

  it("a zero base is not comparable", () => {
    expect(compare(500, 0).percent).toBeNull();
    expect(compare(0, 0).percent).toBeNull();
  });
});

describe("header and day message", () => {
  it("greets by Costa Rica hour", () => {
    expect(greetingFor(4)).toBe("evening");
    expect(greetingFor(5)).toBe("morning");
    expect(greetingFor(12)).toBe("afternoon");
    expect(greetingFor(19)).toBe("evening");
  });

  it("picks a message from the day's figures", () => {
    expect(dayMessage({ operatingToday: true, salesToday: 0, daily: null }).key).toBe("noSalesYet");
    expect(dayMessage({ operatingToday: false, salesToday: 0, daily: null }).key).toBe("closedToday");
    expect(dayMessage({ operatingToday: true, salesToday: 100, daily: goalProgress(100, 50, 1) })).toEqual({ key: "dailyGoalReached" });
    expect(dayMessage({ operatingToday: true, salesToday: 100, daily: goalProgress(100, 300, 1) })).toEqual({ key: "dailyGoalRemaining", amount: 200 });
    expect(dayMessage({ operatingToday: true, salesToday: 100, daily: null })).toEqual({ key: "salesSoFar", amount: 100 });
  });
});

describe("recommendations (§9)", () => {
  const base: RecommendationFacts = {
    today: "2026-11-20",
    scope: "all",
    previousFortnight: { key: "2026-11-1", to: "2026-11-15", closed: true },
    pendingCommissions: { count: 0, amount: 0, before: "2026-11-16" },
    month: { key: "2026-11", progress: null, elapsedOperatingDays: 19, totalOperatingDays: 30 },
    yesterday: { date: "2026-11-19", operating: true, locationsWithoutSales: [] },
  };

  it("nothing to flag → no recommendations", () => {
    expect(buildRecommendations(base)).toEqual([]);
  });

  it("an ended fortnight that isn't closed is an alert linking to it", () => {
    const [r] = buildRecommendations({ ...base, previousFortnight: { ...base.previousFortnight, closed: false } });
    expect(r).toMatchObject({ key: "fortnightUnclosed:2026-11-1", category: "alert", href: "/barbers/settlements?period=2026-11-1" });
  });

  it("behind the goal's pace by more than 10% is an alert", () => {
    // Expected by now: 30,000 × 19/30 = 19,000. 10,000 is far behind.
    const recs = buildRecommendations({ ...base, month: { ...base.month, progress: goalProgress(10_000, 30_000, 11) } });
    expect(recs.map((r) => r.code)).toEqual(["goalBehind"]);
    expect(recs[0].values.expected).toBe(19_000);
  });

  it("on pace → no alert; reached → info", () => {
    expect(buildRecommendations({ ...base, month: { ...base.month, progress: goalProgress(18_000, 30_000, 11) } })).toEqual([]);
    const [r] = buildRecommendations({ ...base, month: { ...base.month, progress: goalProgress(31_000, 30_000, 11) } });
    expect(r).toMatchObject({ code: "goalReached", category: "info" });
  });

  it("pending product commissions and a location with no sales yesterday are follow-ups", () => {
    const recs = buildRecommendations({
      ...base,
      pendingCommissions: { count: 3, amount: 4500, before: "2026-11-16" },
      yesterday: { ...base.yesterday, locationsWithoutSales: [{ id: "loc1", name: "Concepción" }] },
    });
    expect(recs.map((r) => [r.code, r.category])).toEqual([
      ["commissionsPending", "followUp"],
      ["noSalesYesterday", "followUp"],
    ]);
    expect(recs[1].key).toBe("noSalesYesterday:2026-11-19:loc1");
  });

  it("no 'no sales' follow-up for a day the shop doesn't open", () => {
    const recs = buildRecommendations({
      ...base,
      yesterday: { date: "2026-11-19", operating: false, locationsWithoutSales: [{ id: "loc1", name: "X" }] },
    });
    expect(recs).toEqual([]);
  });
});
