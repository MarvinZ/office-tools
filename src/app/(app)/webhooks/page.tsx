import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getWebhookEndpoint, listWebhookEvents } from "@/services/webhooks/webhooks";
import EndpointPanel from "./_components/endpoint-panel";
import EventListClient from "./_components/event-list-client";
import CreateEndpointPanel from "./_components/create-endpoint-panel";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("webhooks")]);
  const endpoint = await getWebhookEndpoint(tenant.id);
  const events = endpoint ? await listWebhookEvents(tenant.id) : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("page.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("page.subtitle")}</p>
      </div>

      {endpoint ? <EndpointPanel endpoint={endpoint} /> : <CreateEndpointPanel />}

      {endpoint && <EventListClient events={events} />}
    </div>
  );
}
