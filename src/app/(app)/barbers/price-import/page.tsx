import { getTranslations } from "next-intl/server";
import PriceImportClient from "./_components/price-import-client";

export const dynamic = "force-dynamic";

/** Load service and product prices from an Excel template (admins). */
export default async function PriceImportPage() {
  const t = await getTranslations("barbers.priceImport");
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>
      <PriceImportClient />
    </div>
  );
}
