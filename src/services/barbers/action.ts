import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BarbersError, TranslatedError, type ActionResult } from "@/lib/barbers/errors";

/**
 * Runs a Barbers server action and returns its result instead of throwing.
 * Next.js replaces thrown messages with a generic English text in production,
 * so people would never see why something was refused. Here a BarbersError
 * becomes its message in the viewer's language; anything unexpected is logged
 * and shown as a translated "something went wrong". Redirects still redirect.
 */
export async function barbersAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    unstable_rethrow(err); // redirect() / notFound() keep working
    const t = await getTranslations("barbers.errors");
    if (err instanceof BarbersError) return { ok: false, error: t(err.code, err.values ?? {}) };
    if (err instanceof TranslatedError) return { ok: false, error: err.message };
    console.error("[barbers action]", err);
    return { ok: false, error: t("generic") };
  }
}
