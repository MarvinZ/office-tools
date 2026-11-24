import { requireBarbersPage } from "@/services/barbers/roles";
import { PAGE_AREAS } from "@/lib/barbers/permissions";

// Only roles allowed to see /barbers/locations get past this (lib/barbers/permissions.ts).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireBarbersPage(PAGE_AREAS["/barbers/locations"]);
  return children;
}
