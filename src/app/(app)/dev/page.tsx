import { getTranslations } from "next-intl/server";
import FileManager from "../dashboard/_components/file-manager";
import SendEmailForm from "../dashboard/_components/send-email-form";

export default async function DevToolsPage() {
  const t = await getTranslations("dev");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("description")}</p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-black dark:text-white">{t("fileBrowser")}</h2>
        <FileManager />
      </div>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-black dark:text-white">{t("testEmail")}</h2>
        <SendEmailForm />
      </div>
    </div>
  );
}
