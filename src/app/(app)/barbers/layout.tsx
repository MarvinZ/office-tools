import { requireTool } from "@/services/tenants";
import { getMyBarbersRole } from "@/services/barbers/roles";
import { canAny, PAGE_AREAS } from "@/lib/barbers/permissions";
import BarbersShell from "./_components/barbers-shell";

// Every page under /barbers requires the tool to be enabled for the tenant.
export default async function BarbersLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTool("barbers");
  const { role } = await getMyBarbersRole(tenant);
  const visible = Object.entries(PAGE_AREAS)
    .filter(([, areas]) => canAny(role, areas))
    .map(([href]) => href);
  return <BarbersShell visible={visible}>{children}</BarbersShell>;
}
