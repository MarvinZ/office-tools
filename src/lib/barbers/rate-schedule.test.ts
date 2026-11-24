import { describe, expect, it } from "vitest";
import { commissionRateOn, scopeRateOn, type RateChange } from "./rate-schedule";

const change = (c: Partial<RateChange> & Pick<RateChange, "effectiveFrom" | "rate">): RateChange => ({
  serviceId: null,
  previousRate: null,
  createdAt: "2026-11-01T00:00:00Z",
  ...c,
});

describe("scopeRateOn", () => {
  it("uses the baseline when there are no dated changes", () => {
    expect(scopeRateOn([], null, "2026-11-10", 0.5)).toBe(0.5);
  });

  it("Brayan's example: 50% until the 9th, 55% from the 10th, same fortnight", () => {
    const changes = [change({ effectiveFrom: "2026-11-10", rate: 0.55, previousRate: 0.5 })];
    expect(scopeRateOn(changes, null, "2026-11-09", 0.55)).toBe(0.5);
    expect(scopeRateOn(changes, null, "2026-11-10", 0.55)).toBe(0.55);
    expect(scopeRateOn(changes, null, "2026-11-15", 0.55)).toBe(0.55);
  });

  it("applies several changes in date order; the later entry wins on the same date", () => {
    const changes = [
      change({ effectiveFrom: "2026-12-01", rate: 0.6, previousRate: 0.55 }),
      change({ effectiveFrom: "2026-11-10", rate: 0.55, previousRate: 0.5 }),
      change({ effectiveFrom: "2026-12-01", rate: 0.65, previousRate: 0.6, createdAt: "2026-11-20T00:00:00Z" }),
    ];
    expect(scopeRateOn(changes, null, "2026-11-01", null)).toBe(0.5);
    expect(scopeRateOn(changes, null, "2026-11-20", null)).toBe(0.55);
    expect(scopeRateOn(changes, null, "2026-12-01", null)).toBe(0.65);
  });

  it("a change to 'no rate' falls back from its date", () => {
    const changes = [change({ effectiveFrom: "2026-11-16", rate: null, previousRate: 1 })];
    expect(scopeRateOn(changes, null, "2026-11-15", null)).toBe(1);
    expect(scopeRateOn(changes, null, "2026-11-16", 1)).toBeNull();
  });
});

describe("commissionRateOn", () => {
  const baselines = { fixed: 0.6, overrides: new Map([["color", 0.65]]) };

  it("override, then fixed rate, then the fallback", () => {
    expect(commissionRateOn([], baselines, "color", "2026-11-10", 0.5)).toEqual({ rate: 0.65, source: "override" });
    expect(commissionRateOn([], baselines, "cut", "2026-11-10", 0.5)).toEqual({ rate: 0.6, source: "barber" });
    expect(commissionRateOn([], { fixed: null, overrides: new Map() }, null, "2026-11-10", 0.5)).toEqual({
      rate: 0.5,
      source: "default",
    });
  });

  it("dated changes per scope are independent", () => {
    const changes = [
      change({ serviceId: "color", effectiveFrom: "2026-11-10", rate: 0.7, previousRate: 0.65 }),
      change({ serviceId: null, effectiveFrom: "2026-11-12", rate: 0.55, previousRate: 0.6 }),
    ];
    expect(commissionRateOn(changes, baselines, "color", "2026-11-11", 0.5).rate).toBe(0.7);
    expect(commissionRateOn(changes, baselines, "cut", "2026-11-11", 0.5).rate).toBe(0.6);
    expect(commissionRateOn(changes, baselines, "cut", "2026-11-12", 0.5).rate).toBe(0.55);
  });
});
