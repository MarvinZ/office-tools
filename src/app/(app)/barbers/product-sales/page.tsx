import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listBarbers } from "@/services/barbers/barbers";
import { listProducts } from "@/services/barbers/products";
import { listProductSales } from "@/services/barbers/product-sales";
import ProductSaleForm from "./_components/product-sale-form";

export const dynamic = "force-dynamic";

export default async function ProductSalesPage() {
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers")]);

  const [allBarbers, allProducts, sales] = await Promise.all([
    listBarbers(tenant.id),
    listProducts(tenant.id),
    listProductSales(tenant.id),
  ]);

  // Only currently-sellable items are offered in the picker; retired products
  // stay out of the form but remain visible in the history below.
  const activeBarbers = allBarbers.filter((b) => b.status === "active");
  const activeProducts = allProducts.filter((p) => p.status === "active");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("productSales.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("productSales.subtitle")}</p>
      </div>

      <ProductSaleForm barbers={activeBarbers} products={activeProducts} initialSales={sales} />
    </div>
  );
}
