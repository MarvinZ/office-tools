import { describe, expect, it } from "vitest";
import {
  ageGroupOf, ageOn, birthdayInMonth, demographics, missingFields, phoneDigits, usualBarber, validateClient, whatsappLink,
} from "./clients";

describe("ages", () => {
  it("whole years, the birthday itself included", () => {
    expect(ageOn("1990-11-27", "2026-11-27")).toBe(36);
    expect(ageOn("1990-11-28", "2026-11-27")).toBe(35);
    expect(ageOn("1990-12-01", "2026-11-27")).toBe(35);
  });

  it("the PDF's ranges (§11)", () => {
    expect(ageGroupOf(17)).toBe("0-17");
    expect(ageGroupOf(18)).toBe("18-24");
    expect(ageGroupOf(30)).toBe("25-30");
    expect(ageGroupOf(31)).toBe("31-40");
    expect(ageGroupOf(60)).toBe("51-60");
    expect(ageGroupOf(61)).toBe("61+");
    expect(ageGroupOf(null)).toBe("unknown");
  });

  it("distribution with counts, percentages and unknown ages", () => {
    const d = demographics(["2010-01-01", "2000-05-05", "2000-06-06", null], "2026-11-27");
    expect(d.total).toBe(4);
    expect(d.groups.find((g) => g.key === "0-17")).toEqual({ key: "0-17", count: 1, percent: 25 });
    expect(d.groups.find((g) => g.key === "25-30")).toEqual({ key: "25-30", count: 2, percent: 50 });
    expect(d.groups.at(-1)).toEqual({ key: "unknown", count: 1, percent: 25 });
    expect(demographics([], "2026-11-27").groups.every((g) => g.count === 0 && g.percent === 0)).toBe(true);
  });
});

describe("records", () => {
  it("phone and birth date make a record complete (§13)", () => {
    expect(missingFields({ phone: "8888-1234", birthDate: "1990-01-01" })).toEqual([]);
    expect(missingFields({ phone: " ", birthDate: null })).toEqual(["phone", "birthDate"]);
  });

  it("validation", () => {
    expect(validateClient({ fullName: "Ana" }, "2026-11-27")).toBeNull();
    expect(validateClient({ fullName: "  " }, "2026-11-27")).toBe("nameRequired");
    expect(validateClient({ fullName: "Ana", birthDate: "2027-01-01" }, "2026-11-27")).toBe("invalidDate");
    expect(validateClient({ fullName: "Ana", email: "ana@" }, "2026-11-27")).toBe("invalidEmail");
  });
});

describe("birthdays (§10.2)", () => {
  it("the day in the month, 29 Feb on a common year", () => {
    expect(birthdayInMonth("1990-11-27", "2026-11")).toBe("2026-11-27");
    expect(birthdayInMonth("1990-10-27", "2026-11")).toBeNull();
    expect(birthdayInMonth("2000-02-29", "2026-02")).toBe("2026-02-28");
    expect(birthdayInMonth(null, "2026-11")).toBeNull();
  });

  it("WhatsApp link with the message to review, CR numbers get 506", () => {
    expect(whatsappLink("8888-1234", "¡Feliz cumpleaños!")).toBe(`https://wa.me/50688881234?text=${encodeURIComponent("¡Feliz cumpleaños!")}`);
    expect(whatsappLink("+1 (555) 123-4567", "hi")).toBe("https://wa.me/15551234567?text=hi");
    expect(whatsappLink("123", "hi")).toBeNull();
    expect(phoneDigits(null)).toBe("");
  });
});

describe("usual professional", () => {
  it("most visits; ties go to the most recent", () => {
    expect(usualBarber([])).toBeNull();
    expect(usualBarber([{ barberId: "a", date: "2026-11-01" }, { barberId: "b", date: "2026-11-02" }, { barberId: "a", date: "2026-11-03" }])).toBe("a");
    expect(usualBarber([{ barberId: "a", date: "2026-11-01" }, { barberId: "b", date: "2026-11-05" }])).toBe("b");
  });
});
