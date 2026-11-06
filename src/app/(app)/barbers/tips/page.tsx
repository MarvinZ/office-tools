import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listBarbers } from "@/services/barbers/barbers";
import { listTips } from "@/services/barbers/tips";
import TipForm from "./_components/tip-form";

export const dynamic = "force-dynamic";

export default async function TipsPage() {
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers")]);

  const [allBarbers, tips] = await Promise.all([
    listBarbers(tenant.id),
    listTips(tenant.id),
  ]);

  const activeBarbers = allBarbers.filter((b) => b.status === "active");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("tips.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("tips.subtitle")}</p>
      </div>

      <TipForm barbers={activeBarbers} initialTips={tips} />
    </div>
  );
}
