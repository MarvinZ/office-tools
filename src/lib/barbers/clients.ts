/**
 * Client rules for the Barbers module (NOURA Módulo 1 §10–11). Pure and unit
 * tested (clients.test.ts); services/barbers/clients.ts loads the data.
 */

/** §11: the age ranges, in order. "unknown" = no birth date on the record. */
export const AGE_GROUPS = [
  { key: "0-17", min: 0, max: 17 },
  { key: "18-24", min: 18, max: 24 },
  { key: "25-30", min: 25, max: 30 },
  { key: "31-40", min: 31, max: 40 },
  { key: "41-50", min: 41, max: 50 },
  { key: "51-60", min: 51, max: 60 },
  { key: "61+", min: 61, max: Infinity },
] as const;
export type AgeGroupKey = (typeof AGE_GROUPS)[number]["key"] | "unknown";

/** Whole years between a YYYY-MM-DD birth date and a YYYY-MM-DD day. */
export function ageOn(birthDate: string, date: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

export function ageGroupOf(age: number | null): AgeGroupKey {
  if (age == null || age < 0) return "unknown";
  return AGE_GROUPS.find((g) => age >= g.min && age <= g.max)?.key ?? "unknown";
}

export type Demographics = {
  total: number;
  groups: { key: AgeGroupKey; count: number; percent: number }[];
};

/** Distribution of clients by age range, unknown ages last (§11). */
export function demographics(birthDates: (string | null)[], today: string): Demographics {
  const counts = new Map<AgeGroupKey, number>();
  for (const b of birthDates) {
    const key = ageGroupOf(b ? ageOn(b, today) : null);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = birthDates.length;
  const keys: AgeGroupKey[] = [...AGE_GROUPS.map((g) => g.key), "unknown"];
  return {
    total,
    groups: keys.map((key) => {
      const count = counts.get(key) ?? 0;
      return { key, count, percent: total ? Math.round((count / total) * 1000) / 10 : 0 };
    }),
  };
}

/** What a record is missing to be complete (§13 "Dato incompleto"): phone and birth date. */
export function missingFields(c: { phone: string | null; birthDate: string | null }): ("phone" | "birthDate")[] {
  const out: ("phone" | "birthDate")[] = [];
  if (!c.phone?.trim()) out.push("phone");
  if (!c.birthDate) out.push("birthDate");
  return out;
}

/** The birthday in a "YYYY-MM" month, as YYYY-MM-DD, or null. 29 Feb → 28 Feb in common years. */
export function birthdayInMonth(birthDate: string | null, month: string): string | null {
  if (!birthDate || birthDate.slice(5, 7) !== month.slice(5, 7)) return null;
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Number(birthDate.slice(8, 10)), lastDay);
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** The professional who served a client most often; ties go to the most recent. */
export function usualBarber(visits: { barberId: string; date: string }[]): string | null {
  const stats = new Map<string, { n: number; last: string }>();
  for (const v of visits) {
    const s = stats.get(v.barberId) ?? { n: 0, last: "" };
    s.n++;
    if (v.date > s.last) s.last = v.date;
    stats.set(v.barberId, s);
  }
  let best: string | null = null;
  let bestStat = { n: 0, last: "" };
  for (const [id, s] of stats) {
    if (s.n > bestStat.n || (s.n === bestStat.n && s.last > bestStat.last)) {
      best = id;
      bestStat = s;
    }
  }
  return best;
}

/** Digits only, for searching and links ("8888-1234" → "88881234"). */
export function phoneDigits(phone: string | null): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * A WhatsApp link that opens a chat with the message ready to review and send
 * (§10.2: the admin authorizes every message). Costa Rican 8-digit numbers get
 * the 506 country code. null when there's no usable number.
 */
export function whatsappLink(phone: string | null, text: string): string | null {
  let digits = phoneDigits(phone);
  if (digits.length === 8) digits = `506${digits}`;
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export type ClientInput = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  birthDate?: string | null;
  notes?: string | null;
};

/** The first problem with a client record, or null. A birth date can't be in the future. */
export function validateClient(c: ClientInput, today: string): "nameRequired" | "invalidDate" | "invalidEmail" | null {
  if (!c.fullName.trim()) return "nameRequired";
  if (c.birthDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.birthDate) || c.birthDate > today || c.birthDate < "1900-01-01") return "invalidDate";
  }
  const email = c.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "invalidEmail";
  return null;
}
