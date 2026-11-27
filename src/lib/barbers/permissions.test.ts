import { describe, expect, it } from "vitest";
import { can, canAny, homeOf, PAGE_AREAS } from "./permissions";

describe("barbers permissions", () => {
  it("cashiers do front-desk work only", () => {
    expect(can("cashier", "operate")).toBe(true);
    expect(can("cashier", "view")).toBe(false);
    expect(can("cashier", "settle")).toBe(false);
    expect(can("cashier", "configure")).toBe(false);
    expect(can("cashier", "overview")).toBe(false);
  });

  it("the accountant only reads pay figures", () => {
    expect(can("accountant", "view")).toBe(true);
    expect(canAny("accountant", ["operate", "settle", "configure", "overview"])).toBe(false);
    expect(homeOf("accountant")).toBe("/barbers/settlements");
  });

  it("admins can do everything", () => {
    expect(canAny("admin", ["operate"]) && can("admin", "view") && can("admin", "settle") && can("admin", "configure")).toBe(true);
  });

  it("only admins see the admin panel (Módulo 1 CA 01/02)", () => {
    expect(canAny("admin", PAGE_AREAS["/barbers/panel"])).toBe(true);
    expect(canAny("cashier", PAGE_AREAS["/barbers/panel"])).toBe(false);
    expect(canAny("accountant", PAGE_AREAS["/barbers/panel"])).toBe(false);
  });

  it("every page is reachable by an admin and settlements are hidden from cashiers", () => {
    for (const areas of Object.values(PAGE_AREAS)) expect(canAny("admin", areas)).toBe(true);
    expect(canAny("cashier", PAGE_AREAS["/barbers/settlements"])).toBe(false);
    expect(canAny("cashier", PAGE_AREAS["/barbers/product-closing"])).toBe(true);
  });
});
