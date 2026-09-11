import Image from "next/image";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.subscriptionStatus === "PENDING_PAYMENT") redirect("/pagamento-pendente");
  if (user.onboardingCompleted) redirect("/dashboard");

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-brand-950">
      <header className="flex items-center gap-2.5 px-5 py-4 border-b border-white/10">
        <Image src="/logo-transparent.png" alt="Tobias" width={28} height={28} />
        <span className="font-display text-lg text-onbrand">Tobias</span>
      </header>
      {children}
    </div>
  );
}
