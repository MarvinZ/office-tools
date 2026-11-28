import { requireBarbersPage } from "@/services/barbers/roles";
import { PAGE_AREAS } from "@/lib/barbers/permissions";

// Admins and the accountant (Módulo 1 §15: expenses aren't for cashiers).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireBarbersPage(PAGE_AREAS["/barbers/expenses"]);
  return children;
}
