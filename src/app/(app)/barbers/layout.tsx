"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Scissors,
  Banknote,
  ShoppingCart,
  BarChart3,
  Settings,
  ChevronDown,
  Users,
  MapPin,
  Sparkles,
  Package,
  CreditCard,
} from "lucide-react";
import { useTranslations } from "next-intl";

// Daily operations — what front desk uses constantly, always visible.
const OPERATION_TABS = [
  { href: "/barbers", labelKey: "tabLog", icon: Scissors, exact: true },
  { href: "/barbers/vales", labelKey: "tabVales", icon: Banknote, exact: false },
  { href: "/barbers/product-sales", labelKey: "tabProductSales", icon: ShoppingCart, exact: false },
  { href: "/barbers/reports", labelKey: "tabReports", icon: BarChart3, exact: false },
] as const;

// Setup/configuration — touched rarely, collapsed into one "Catalogs" menu so
// the visible tab row stays short instead of scrolling sideways.
const CATALOG_ITEMS = [
  { href: "/barbers/barbers", labelKey: "tabBarbers", icon: Users },
  { href: "/barbers/locations", labelKey: "tabLocations", icon: MapPin },
  { href: "/barbers/services", labelKey: "tabServices", icon: Sparkles },
  { href: "/barbers/products", labelKey: "tabProducts", icon: Package },
  { href: "/barbers/payment-methods", labelKey: "tabPaymentMethods", icon: CreditCard },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function BarbersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("barbers");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const inCatalogSection = CATALOG_ITEMS.some((item) => isActive(pathname, item.href, false));

  useEffect(() => {
    if (!catalogOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCatalogOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [catalogOpen]);

  const tabCls = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
      active
        ? "border-black text-black dark:border-white dark:text-white"
        : "border-transparent text-zinc-400 hover:text-black dark:hover:text-white"
    }`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4">
          {/*
            Only the tab links scroll horizontally on narrow screens. The
            Catalogs dropdown sits outside this scroll container on purpose:
            an `overflow-x-auto` ancestor also clips the OTHER axis, so an
            absolutely-positioned dropdown panel inside it gets cut off the
            moment it extends past the row's bottom edge.
          */}
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {OPERATION_TABS.map(({ href, labelKey, icon: Icon, exact }) => (
              <Link key={href} href={href} className={tabCls(isActive(pathname, href, exact))}>
                <Icon size={14} />
                {t(labelKey)}
              </Link>
            ))}
          </div>

          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setCatalogOpen((v) => !v)}
              aria-expanded={catalogOpen}
              aria-haspopup="menu"
              className={tabCls(inCatalogSection || catalogOpen)}
            >
              <Settings size={14} />
              {t("tabCatalogs")}
              <ChevronDown size={12} className={`transition-transform ${catalogOpen ? "rotate-180" : ""}`} />
            </button>

            {catalogOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              >
                {CATALOG_ITEMS.map(({ href, labelKey, icon: Icon }) => {
                  const active = isActive(pathname, href, false);
                  return (
                    <Link
                      key={href}
                      href={href}
                      role="menuitem"
                      onClick={() => setCatalogOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2.5 text-sm ${
                        active
                          ? "bg-zinc-100 font-medium text-black dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <Icon size={14} />
                      {t(labelKey)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
