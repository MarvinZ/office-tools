/**
 * Errors the Barbers module shows to people. Thrown with a code (and values);
 * the message is looked up in messages/*.json under barbers.errors.<code> by
 * barbersAction (services/barbers/action.ts), so it's in the viewer's language
 * and survives production builds (Next.js hides thrown messages from clients).
 */

export type BarbersErrorCode =
  | "generic"
  | "notAuthenticated"
  | "forbidden"
  | "notFound"
  | "rateUnresolved"
  | "invalidDate"
  | "invalidInput"
  | "emptyBatch"
  | "amountPositive"
  | "quantityInvalid"
  | "rateOutOfRange"
  | "ivaRateRange"
  | "ivaBaseRange"
  | "maintenanceFeeNegative"
  | "additionNegative"
  | "commissionNegative"
  | "commissionAbovePrice"
  | "invalidIban"
  | "invalidEmail"
  | "voidReasonRequired"
  | "voidWarrantyFirst"
  | "warrantyExists"
  | "warrantyNotAllowed"
  | "fortnightClosed"
  | "fortnightNotStarted"
  | "nextFortnightClosed"
  | "reopenReasonRequired"
  | "closeBeforeCarry"
  | "noShortfall"
  | "shortfallToSalary"
  | "carryAmount"
  | "carryExists"
  | "rateChangeStarted"
  | "commissionAlreadyPaid"
  | "chooseCommissionsToPay"
  | "chooseFiles"
  | "tooManyFiles"
  | "onlyXlsx"
  | "fileTooLarge"
  | "goalNegative"
  | "ownRole"
  | "notInOrganization";

export class BarbersError extends Error {
  constructor(
    public readonly code: BarbersErrorCode,
    public readonly values?: Record<string, string | number>
  ) {
    super(code);
    this.name = "BarbersError";
  }
}

/** What a Barbers server action returns: data, or an already-translated message. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** An error whose message is already translated (from a failed ActionResult). */
export class TranslatedError extends Error {
  readonly translated = true;
}

/**
 * Client side (and action-to-action): the data, or throw the translated
 * message so existing `catch (e) { setError(e.message) }` code shows it.
 */
export async function unwrap<T>(result: Promise<ActionResult<T>> | ActionResult<T>): Promise<T> {
  const r = await result;
  if (!r.ok) throw new TranslatedError(r.error);
  return r.data;
}
