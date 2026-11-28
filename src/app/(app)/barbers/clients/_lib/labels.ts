import { AGE_GROUPS } from "@/lib/barbers/clients";

/** Range key → its label ("18 a 24", "61 o más", "Edad desconocida"). */
export function ageLabels(t: (key: string, values?: Record<string, string | number>) => string): Record<string, string> {
  const out: Record<string, string> = { unknown: t("ageUnknown") };
  for (const g of AGE_GROUPS) {
    out[g.key] = g.max === Infinity ? t("ageOrMore", { min: g.min }) : t("ageRange", { min: g.min, max: g.max });
  }
  return out;
}
