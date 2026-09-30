import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { getVisiblePricingPlans } from "@/services/billingPlans";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const plans = await getVisiblePricingPlans();

  return (
    <Card>
      <CardContent className="pt-6">
        <Suspense fallback={null}>
          <SignupForm plans={plans} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
