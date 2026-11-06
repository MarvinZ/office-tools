import { requireTool } from "@/services/tenants";
import BarbersShell from "./_components/barbers-shell";

// Every page under /barbers requires the tool to be enabled for the tenant.
export default async function BarbersLayout({ children }: { children: React.ReactNode }) {
  await requireTool("barbers");
  return <BarbersShell>{children}</BarbersShell>;
}
