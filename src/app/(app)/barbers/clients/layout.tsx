import { requireBarbersPage } from "@/services/barbers/roles";
import { PAGE_AREAS } from "@/lib/barbers/permissions";

// Client activity and demographics are for administrators (Módulo 1 §15).
// The front desk only picks or creates clients while charging.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireBarbersPage(PAGE_AREAS["/barbers/clients"]);
  return children;
}
