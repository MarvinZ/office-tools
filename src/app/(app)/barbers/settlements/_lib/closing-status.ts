import { businessDateOf, fmtDay } from "@/lib/barbers/dates";
import type { FortnightClosingInfo } from "@/services/barbers/settlements";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** "Closed 16/10/2026 · v2", "Superseded v1 (reopened 17/10/2026)" or "Preliminary". */
export function closingStatus(t: Translate, closing: FortnightClosingInfo | null): string {
  if (!closing) return t("settlements.preliminary");
  const closedOn = fmtDay(businessDateOf(closing.closedAt));
  if (closing.reopenedAt) {
    return t("settlements.supersededVersion", {
      version: closing.version,
      date: fmtDay(businessDateOf(closing.reopenedAt)),
    });
  }
  return closing.version > 1
    ? t("settlements.closedOnVersion", { date: closedOn, version: closing.version })
    : t("settlements.closedOn", { date: closedOn });
}

/** ?version=N → N, anything else → undefined (show the current state). */
export function parseVersion(value: string | null | undefined): number | undefined {
  if (!value || !/^\d{1,4}$/.test(value)) return undefined;
  return Number(value);
}
