import { requireTool } from "@/services/tenants";

// Every page under /providers requires the tool to be enabled for the tenant.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireTool("providers");
  return children;
}
