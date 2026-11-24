import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getBarberSettings } from "@/services/barbers/settings";
import SettingsForm from "./_components/settings-form";
import MemberRoles from "./_components/member-roles";
import { getMyBarbersRole, listBarbersMembers } from "@/services/barbers/roles";

export const dynamic = "force-dynamic";

export default async function BarberSettingsPage() {
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers")]);
  const [settings, me] = await Promise.all([getBarberSettings(tenant.id), getMyBarbersRole(tenant)]);
  // The member list comes from Clerk; if it can't be reached, the rest of the page still works.
  const members = await listBarbersMembers(tenant).catch(() => null);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("settingsPage.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("settingsPage.subtitle")}</p>
      </div>
      <SettingsForm initial={settings} />
      {members && <MemberRoles members={members} me={me.userId} />}
    </div>
  );
}
