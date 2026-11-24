import { getTranslations } from "next-intl/server";
import { getAvailableTools, getCurrentTenant } from "@/services/tenants";
import { getMyBarbersRole } from "@/services/barbers/roles";
import { can } from "@/lib/barbers/permissions";
import { priceTemplate } from "@/services/barbers/price-import";

export const dynamic = "force-dynamic";

/** GET → the price template (.xlsx), pre-filled with the current catalog. */
export async function GET() {
  const me = await getMyBarbersRole().catch(() => null);
  if (!me || !can(me.role, "configure")) return new Response("Forbidden", { status: 403 });
  const tenant = await getCurrentTenant();
  if (!tenant) return new Response("Unauthorized", { status: 401 });
  if (!(await getAvailableTools(tenant)).includes("barbers")) return new Response("Forbidden", { status: 403 });

  const t = await getTranslations("barbers.priceImport.template");
  const body = await priceTemplate(tenant.id, {
    servicesSheet: t("servicesSheet"),
    productsSheet: t("productsSheet"),
    name: t("name"),
    category: t("category"),
    commissionPct: t("commissionPct"),
    priceAt: (location) => t("priceAt", { location }),
    price: t("price"),
    commissionAmount: t("commissionAmount"),
    chargesIva: t("chargesIva"),
    yes: t("yes"),
    no: t("no"),
  });
  const fileName = `${t("fileName")}.xlsx`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="prices.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
