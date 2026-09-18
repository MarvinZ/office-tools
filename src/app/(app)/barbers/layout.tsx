"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scissors, Users, MapPin, Sparkles, CreditCard, BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";

const TABS = [
  { href: "/barbers", labelKey: "tabLog", icon: Scissors, exact: true },
  { href: "/barbers/barbers", labelKey: "tabBarbers", icon: Users, exact: false },
  { href: "/barbers/locations", labelKey: "tabLocations", icon: MapPin, exact: false },
  { href: "/barbers/services", labelKey: "tabServices", icon: Sparkles, exact: false },
  { href: "/barbers/payment-methods", labelKey: "tabPaymentMethods", icon: CreditCard, exact: false },
  { href: "/barbers/reports", labelKey: "tabReports", icon: BarChart3, exact: false },
] as const;

export default function BarbersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("barbers");

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4">
          {TABS.map(({ href, labelKey, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-black text-black dark:border-white dark:text-white"
                    : "border-transparent text-zinc-400 hover:text-black dark:hover:text-white"
                }`}
              >
                <Icon size={14} />
                {t(labelKey)}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
