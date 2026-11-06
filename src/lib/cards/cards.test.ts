import { describe, expect, it } from "vitest";
import { CurrencyTotals, formatCents, toCents } from "./money";
import { resolveItemPrice, type StoredPrice } from "./pricing";
import { canReadCollection, canWriteCollection } from "./permissions";
import { mergeItems } from "./merge";
import { addItemSchema, listItemsQuerySchema, patchItemSchema } from "./validation";

const price = (p: Partial<StoredPrice>): StoredPrice => ({
  variant: "normal", source: "TCGplayer", currency: "USD", marketPrice: "1.00", observedOn: "2026-11-05", ...p,
});

describe("money", () => {
  it("round-trips decimal strings through cents without float error", () => {
    expect(toCents("12.3")).toBe(1230);
    expect(toCents("0.07")).toBe(7);
    expect(toCents("5")).toBe(500);
    expect(formatCents(toCents("0.1") + toCents("0.2"))).toBe("0.30");
  });
  it("rejects malformed amounts", () => {
    for (const bad of ["-1", "1.234", "1e3", "", "abc"]) expect(() => toCents(bad)).toThrow();
  });
  it("totals per currency and never mixes them", () => {
    const t = new CurrencyTotals();
    t.add("USD", 250); t.add("EUR", 310); t.add("USD", 100);
    expect(t.toJSON()).toEqual({ EUR: "3.10", USD: "3.50" });
  });
});

describe("resolveItemPrice", () => {
  it("uses the item's own printing, preferring TCGplayer USD", () => {
    const p = resolveItemPrice(
      [price({ variant: "holofoil", source: "Cardmarket", currency: "EUR", marketPrice: "9.00" }),
       price({ variant: "holofoil", marketPrice: "2.50" })],
      "holofoil",
    );
    expect(p).toMatchObject({ amount: "2.50", currency: "USD", isFallback: false });
  });
  it("falls back to the headline (base printing) price when the printing has none", () => {
    const p = resolveItemPrice(
      [price({ variant: "reverse-holofoil", marketPrice: "3.00" }), price({ variant: "normal", marketPrice: "1.00" })],
      "holofoil",
    );
    expect(p).toMatchObject({ amount: "1.00", isFallback: true });
  });
  it("uses an EUR-only price when that's all there is", () => {
    expect(resolveItemPrice([price({ variant: "default", source: "Cardmarket", currency: "EUR" })], "normal"))
      .toMatchObject({ currency: "EUR", isFallback: true });
  });
  it("returns null without prices", () => {
    expect(resolveItemPrice([], "normal")).toBeNull();
  });
});

describe("permissions", () => {
  const kid = { collectorId: "a", isParent: false };
  const parent = { collectorId: "p", isParent: true };
  const sibling = { id: "b", isPrivate: false };
  const privateSibling = { id: "b", isPrivate: true };

  it("lets family members read but not write each other's collections", () => {
    expect(canReadCollection(kid, sibling)).toBe(true);
    expect(canWriteCollection(kid, sibling)).toBe(false);
  });
  it("hides private collections from other kids but not from parents", () => {
    expect(canReadCollection(kid, privateSibling)).toBe(false);
    expect(canReadCollection(parent, privateSibling)).toBe(true);
  });
  it("lets owners and parents write", () => {
    expect(canWriteCollection(kid, { id: "a", isPrivate: true })).toBe(true);
    expect(canWriteCollection(parent, sibling)).toBe(true);
  });
});

describe("mergeItems", () => {
  const source = { quantity: 2, isFavorite: true, notes: "from pack", acquiredAt: "2026-10-01" };
  const target = { quantity: 3, isFavorite: false, notes: "birthday", acquiredAt: "2026-09-01" };

  it("sums quantities and keeps everything the collector entered", () => {
    expect(mergeItems(source, target, {})).toEqual({
      quantity: 5, isFavorite: true, notes: "birthday\nfrom pack", acquiredAt: "2026-09-01",
    });
  });
  it("lets explicit patch values win", () => {
    expect(mergeItems(source, target, { quantity: 1, isFavorite: false, notes: null })).toMatchObject({
      quantity: 4, isFavorite: false, notes: null,
    });
  });
});

describe("validation", () => {
  const card = { tcgdexId: "sv01-025", language: "en", name: "Pikachu", setId: "sv01", setName: "Scarlet & Violet", localId: "025" };

  it("applies defaults and trims price dates to the day", () => {
    const input = addItemSchema.parse({
      card, variant: "holofoil",
      prices: [{ variant: "holofoil", amount: "1.25", currency: "USD", source: "TCGplayer", updatedAt: "2026-11-05T20:00:00Z" }],
    });
    expect(input).toMatchObject({ condition: "NM", quantity: 1 });
    expect(input.prices[0].updatedAt).toBe("2026-11-05");
  });
  it("rejects float amounts, zero quantities and non-http image URLs", () => {
    expect(() => addItemSchema.parse({ card, variant: "normal", prices: [{ amount: 1.25, currency: "USD", source: "x" }] })).toThrow();
    expect(() => addItemSchema.parse({ card, variant: "normal", quantity: 0 })).toThrow();
    expect(() => addItemSchema.parse({ card: { ...card, imageUrl: "javascript:alert(1)" }, variant: "normal" })).toThrow();
  });
  it("rejects empty or unknown PATCH fields", () => {
    expect(() => patchItemSchema.parse({})).toThrow();
    expect(() => patchItemSchema.parse({ collectorId: "x" })).toThrow();
    expect(patchItemSchema.parse({ notes: null })).toEqual({ notes: null });
  });
  it("parses list query strings", () => {
    expect(listItemsQuerySchema.parse({ favorite: "true", limit: "10", cursor: "50" }))
      .toMatchObject({ favorite: true, limit: 10, cursor: 50, sort: "added" });
    expect(() => listItemsQuerySchema.parse({ limit: "500" })).toThrow();
  });
});
