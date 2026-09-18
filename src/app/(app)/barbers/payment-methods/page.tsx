import { getTranslations } from "next-intl/server";
import { currentUser } from "@clerk/nextjs/server";
import { requireTenant } from "@/services/tenants";
import { listPaymentMethods, ensureDefaultPaymentMethods } from "@/services/barbers/payment-methods";
import PaymentMethodListClient from "./_components/payment-method-list-client";
import CreatePaymentMethodModal from "./_components/create-payment-method-modal";

export const dynamic = "force-dynamic";

export default async function PaymentMethodsListPage() {
  const [tenant, t, user] = await Promise.all([
    requireTenant(),
    getTranslations("barbers"),
    currentUser(),
  ]);

  // Idempotent: seeds Cash / SINPE / Credit Card only if this tenant has none.
  await ensureDefaultPaymentMethods(tenant.id, user?.id ?? "system");

  const methods = await listPaymentMethods(tenant.id);
  const active = methods.filter((m) => m.status === "active").length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("paymentMethodsPage.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("paymentMethodsPage.subtitle", { total: methods.length, active })}</p>
        </div>
        <CreatePaymentMethodModal />
      </div>
      <PaymentMethodListClient paymentMethods={methods} />
    </div>
  );
}
