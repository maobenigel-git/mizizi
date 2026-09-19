import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";

// Step order and access are enforced in proxy.ts, not here.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingFrame>{children}</OnboardingFrame>;
}
