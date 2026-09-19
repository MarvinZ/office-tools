import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listProducts } from "@/services/barbers/products";
import ProductListClient from "./_components/product-list-client";
import CreateProductModal from "./_components/create-product-modal";

export const dynamic = "force-dynamic";

export default async function ProductsListPage() {
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers")]);
  const products = await listProducts(tenant.id);
  const active = products.filter((p) => p.status === "active").length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("productsPage.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("productsPage.subtitle", { total: products.length, active })}</p>
        </div>
        <CreateProductModal />
      </div>
      <ProductListClient products={products} />
    </div>
  );
}
