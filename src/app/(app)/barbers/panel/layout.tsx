import { requireBarbersPage } from "@/services/barbers/roles";
import { PAGE_AREAS } from "@/lib/barbers/permissions";

// Administrators only (NOURA Módulo 1 §1, CA 02): checked on the server, so a
// cashier who types or pastes the address is sent to their own start page.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireBarbersPage(PAGE_AREAS["/barbers/panel"]);
  return children;
}
