/**
 * The Barbers module is built for a single local (Costa Rica) business, unlike
 * Invoices/Quotes/Clients which store a per-record currency — so this is
 * deliberately hardcoded to colones rather than configurable.
 */
export function fmtColones(n: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `₡${formatted}`;
}
