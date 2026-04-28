import { Suspense } from "react";
import { VerifyOtpScreen } from "@/features/auth/screens/VerifyOtpScreen";

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpScreen />
    </Suspense>
  );
}
