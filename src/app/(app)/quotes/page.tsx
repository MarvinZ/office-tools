import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listQuotes } from "@/services/quotes/quotes";
import QuoteListClient from "./_components/quote-list-client";
import CreateQuoteModal from "./_components/create-quote-modal";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const tenant = await requireTenant();
  const [quotes, t] = await Promise.all([
    listQuotes(tenant.id),
    getTranslations("quotes"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("page.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.subtitle", { count: quotes.length })}
          </p>
        </div>
        <CreateQuoteModal />
      </div>

      <QuoteListClient quotes={quotes} />
    </div>
  );
}
