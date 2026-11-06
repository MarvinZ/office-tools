import { describe, expect, it } from "vitest";
import { businessDateOf, endOfBusinessDay, startOfBusinessDay } from "./dates";

describe("business dates (Costa Rica, UTC−6)", () => {
  it("an evening service in Costa Rica stays on the same business day", () => {
    // 2026-10-15 19:30 in Costa Rica = 2026-10-16 01:30 UTC.
    expect(businessDateOf("2026-10-16T01:30:00Z")).toBe("2026-10-15");
  });

  it("day boundaries are Costa Rica midnight", () => {
    expect(startOfBusinessDay("2026-10-15").toISOString()).toBe("2026-10-15T06:00:00.000Z");
    expect(endOfBusinessDay("2026-10-15").toISOString()).toBe("2026-10-16T05:59:59.999Z");
  });

  it("rejects malformed dates", () => {
    expect(() => startOfBusinessDay("15/10/2026")).toThrow();
  });
});
