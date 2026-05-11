import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";

export function RequireOnboarding({ children }: { children: ReactElement }) {
  const location = useLocation();
  const { hasAnyData, isLoading } = useSupabaseFinanceData();
  const { onboardingData, isReady } = useOnboardingProfile();

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Preparing your workspace...</p>
      </div>
    );
  }

  const isComplete = onboardingData.completed || hasAnyData;
  if (!isComplete) {
    return (
      <Navigate
        to="/onboarding"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
