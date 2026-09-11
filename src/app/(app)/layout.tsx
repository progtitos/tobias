import { requireOnboardedUser } from "@/lib/auth/guards";
import { getTheme } from "@/lib/theme";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboardedUser();
  const theme = await getTheme();
  return (
    <AppShell user={user} theme={theme}>
      {children}
    </AppShell>
  );
}
