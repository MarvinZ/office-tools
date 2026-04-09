import Link from "next/link";
import { getTranslations } from "next-intl/server";
import UploadZone from "./_components/upload-zone";

export default async function PayrollPage() {
  const t = await getTranslations("payroll");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("description")}</p>
        </div>
        <Link href="/payroll/history" className="text-sm text-zinc-400 hover:text-black dark:hover:text-white">
          {t("viewHistory")}
        </Link>
      </div>
      <UploadZone />
    </div>
  );
}
