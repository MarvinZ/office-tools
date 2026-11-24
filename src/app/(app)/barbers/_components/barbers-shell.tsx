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
  HandCoins,
  Calculator,
  SlidersHorizontal,
  History,
  FileUp,
  ShoppingBag,
  Wallet,
  PieChart,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

type NavLink = { href: string; labelKey: string; icon: LucideIcon; exact?: boolean };
type NavMenu = { key: string; labelKey: string; icon: LucideIcon; items: NavLink[] };
type NavEntry = NavLink | NavMenu;

const isMenu = (e: NavEntry): e is NavMenu => "items" in e;

/**
 * Tabs grouped by job so the row stays short: front-desk work first, then
 * pay, then setup. Groups open a menu; a group with a single visible item is
 * shown as a plain tab. Which entries a person sees depends on their role
 * (`visible`, from lib/barbers/permissions.ts).
 */
const NAV: NavEntry[] = [
  { href: "/barbers", labelKey: "tabLog", icon: Scissors, exact: true },
  { href: "/barbers/vales", labelKey: "tabVales", icon: Banknote },
  { href: "/barbers/tips", labelKey: "tabTips", icon: HandCoins },
  {
    key: "products",
    labelKey: "tabGroupProducts",
    icon: ShoppingBag,
    items: [
      { href: "/barbers/product-closing", labelKey: "tabProductClosing", icon: ShoppingBag },
      { href: "/barbers/product-sales", labelKey: "tabProductSales", icon: ShoppingCart },
    ],
  },
  { href: "/barbers/imports", labelKey: "tabImports", icon: FileUp },
  { href: "/barbers/settlements", labelKey: "tabSettlements", icon: Calculator },
  {
    key: "reports",
    labelKey: "tabGroupReports",
    icon: PieChart,
    items: [
      { href: "/barbers/cash", labelKey: "tabCash", icon: Wallet },
      { href: "/barbers/reports", labelKey: "tabReports", icon: BarChart3 },
    ],
  },
  {
    key: "catalogs",
    labelKey: "tabCatalogs",
    icon: Settings,
    items: [
      { href: "/barbers/barbers", labelKey: "tabBarbers", icon: Users },
      { href: "/barbers/locations", labelKey: "tabLocations", icon: MapPin },
      { href: "/barbers/services", labelKey: "tabServices", icon: Sparkles },
      { href: "/barbers/products", labelKey: "tabProducts", icon: Package },
      { href: "/barbers/price-import", labelKey: "tabPriceImport", icon: FileSpreadsheet },
      { href: "/barbers/payment-methods", labelKey: "tabPaymentMethods", icon: CreditCard },
      { href: "/barbers/settings", labelKey: "tabSettings", icon: SlidersHorizontal },
      { href: "/barbers/history", labelKey: "tabHistory", icon: History },
    ],
  },
];

function isActive(pathname: string, href: string, exact = false): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function BarbersShell({ children, visible }: { children: React.ReactNode; visible: string[] }) {
  const pathname = usePathname();
  const t = useTranslations("barbers");
  const allowed = new Set(visible);

  // Filter by role; collapse a group with one visible item into a plain tab.
  const entries: NavEntry[] = NAV.flatMap((e): NavEntry[] => {
    if (!isMenu(e)) return allowed.has(e.href) ? [e] : [];
    const items = e.items.filter((i) => allowed.has(i.href));
    if (items.length === 0) return [];
    if (items.length === 1) return [items[0]];
    return [{ ...e, items }];
  });

  const [open, setOpen] = useState<{ key: string; top: number; left: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    }
    function close() {
      setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  // Close any open menu when the page changes (adjusting state during render,
  // React's recommended alternative to an effect for this).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(null);
  }

  function toggle(key: string, button: HTMLButtonElement) {
    if (open?.key === key) return setOpen(null);
    const r = button.getBoundingClientRect();
    const width = 224;
    setOpen({ key, top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - width - 8) });
  }

  const tabCls = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
      active
        ? "border-black text-black dark:border-white dark:text-white"
        : "border-transparent text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white"
    }`;

  const openMenu = open ? entries.find((e): e is NavMenu => isMenu(e) && e.key === open.key) : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <div ref={barRef} className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black print:hidden">
        {/*
          Same width as the app header. On phones the row scrolls sideways (no
          visible scrollbar); menus open in a fixed layer so the scrolling row
          can't clip them.
        */}
        <nav
          aria-label={t("navLabel")}
          className="mx-auto flex w-full max-w-7xl items-center gap-0.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {entries.map((e) => {
            if (!isMenu(e)) {
              const Icon = e.icon;
              return (
                <Link key={e.href} href={e.href} className={tabCls(isActive(pathname, e.href, e.exact))}>
                  <Icon size={15} />
                  {t(e.labelKey)}
                </Link>
              );
            }
            const Icon = e.icon;
            const active = e.items.some((i) => isActive(pathname, i.href));
            const isOpen = open?.key === e.key;
            return (
              <button
                key={e.key}
                type="button"
                onClick={(ev) => toggle(e.key, ev.currentTarget)}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                className={tabCls(active || isOpen)}
              >
                <Icon size={15} />
                {t(e.labelKey)}
                <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
            );
          })}
        </nav>

        {open && openMenu && (
          <div
            role="menu"
            style={{ top: open.top, left: open.left }}
            className="fixed z-50 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            {openMenu.items.map(({ href, labelKey, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(null)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm ${
                    active
                      ? "bg-zinc-100 font-medium text-black dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon size={15} />
                  {t(labelKey)}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
