import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
