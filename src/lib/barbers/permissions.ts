/**
 * Who can do what in the Barbers module (spec §2.1 roles; Brayan, Nov 2026:
 * "the admin gives each person a role"). One matrix for menus, pages and
 * server actions, so they can't disagree.
 *
 *   operate    front-desk work: log services, vales, tips, products on
 *              credit, record product sales, check-in, preview closings
 *   view       read pay figures: settlements, reports, history, cash report,
 *              product closing, exports
 *   settle     change what gets paid: close/reopen, carry-overs, pay product
 *              commissions
 *   configure  catalogs, rates, shop settings, roles, importing closings
 *   overview   the admin panel: shop-wide sales, goals, comparisons and
 *              recommendations (NOURA Módulo 1: administrators only)
 */

export type BarbersRole = "admin" | "cashier" | "accountant";
export type BarbersArea = "operate" | "view" | "settle" | "configure" | "overview";

export const BARBERS_ROLES: BarbersRole[] = ["admin", "cashier", "accountant"];

const MATRIX: Record<BarbersRole, BarbersArea[]> = {
  admin: ["operate", "view", "settle", "configure", "overview"],
  cashier: ["operate"],
  accountant: ["view"],
};

export function can(role: BarbersRole, area: BarbersArea): boolean {
  return MATRIX[role].includes(area);
}

export function canAny(role: BarbersRole, areas: BarbersArea[]): boolean {
  return areas.some((a) => can(role, a));
}

/** Where a role lands when it opens a page it can't see. */
export function homeOf(role: BarbersRole): string {
  return role === "accountant" ? "/barbers/settlements" : "/barbers";
}

/** Areas that unlock each page/tab (any one is enough). */
export const PAGE_AREAS: Record<string, BarbersArea[]> = {
  "/barbers/panel": ["overview"],
  "/barbers": ["operate"],
  "/barbers/vales": ["operate"],
  "/barbers/product-sales": ["operate"],
  "/barbers/tips": ["operate"],
  "/barbers/product-closing": ["operate", "view"],
  "/barbers/settlements": ["view"],
  "/barbers/imports": ["operate", "view"],
  "/barbers/cash": ["view"],
  "/barbers/reports": ["view"],
  "/barbers/history": ["view"],
  "/barbers/barbers": ["configure"],
  "/barbers/locations": ["configure"],
  "/barbers/services": ["configure"],
  "/barbers/products": ["configure"],
  "/barbers/payment-methods": ["configure"],
  "/barbers/settings": ["configure"],
  "/barbers/price-import": ["configure"],
};
