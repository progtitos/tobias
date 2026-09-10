import Image from "next/image";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.onboardingCompleted) redirect("/dashboard");

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-cream-50">
      <header className="flex items-center gap-2.5 px-5 py-4 border-b border-ink-300/20">
        <Image src="/logo.png" alt="Tobias" width={28} height={28} className="rounded-full" />
        <span className="font-serif text-lg text-brand-950">Tobias</span>
      </header>
      {children}
    </div>
  );
}
