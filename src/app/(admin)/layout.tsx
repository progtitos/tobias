import { requireAdmin } from "@/lib/auth/guards";
import { AdminShell } from "@/components/layout/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <AdminShell adminName={user.name}>{children}</AdminShell>;
}
