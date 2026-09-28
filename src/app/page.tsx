import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import LandingHome from "@/components/landing/Home";

export const metadata: Metadata = {
  title: "Tobias | Planejamento financeiro com seus extratos",
  description:
    "Extratos, lançamentos duplicados e dados atrasados não precisam travar seu planejamento. Importe seus extratos, deixe a IA categorizar e acompanhe seu plano com o Tobias.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Tobias",
    title: "Tobias | Planejamento financeiro com seus extratos",
    description:
      "Organize lançamentos, revise duplicidades e acompanhe seu planejamento financeiro com o Tobias. 15 dias grátis.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tobias | Planejamento financeiro com seus extratos",
    description: "Organize lançamentos, revise duplicidades e acompanhe seu planejamento financeiro com o Tobias.",
  },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");

  return <LandingHome />;
}
