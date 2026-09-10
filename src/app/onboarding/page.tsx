import { requireUser } from "@/lib/auth/guards";
import { getOnboardingMessages } from "@/services/onboarding";
import { OnboardingChat } from "./OnboardingChat";

export default async function OnboardingPage() {
  const user = await requireUser();
  const messages = await getOnboardingMessages(user.id);

  return (
    <OnboardingChat
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role as "USER" | "ASSISTANT", content: m.content }))}
    />
  );
}
