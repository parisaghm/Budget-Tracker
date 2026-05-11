import { useMemo, useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import type { OnboardingData } from "@/types/onboarding";

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const { isDemoMode } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const { onboardingData, isReady, complete } = useOnboardingProfile();
  const { hasAnyData, isLoading, budget, syncFromOnboarding } = useSupabaseFinanceData();
  const completionInFlightRef = useRef(false);

  const targetPath = useMemo(() => {
    const from = location.state as { from?: string } | null;
    return from?.from ?? "/dashboard";
  }, [location.state]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </div>
    );
  }

  if (!user) {
    if (isDemoMode) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Preparing setup...</p>
      </div>
    );
  }

  if ((onboardingData.completed || hasAnyData) && !completionInFlightRef.current) {
    return <Navigate to={targetPath} replace />;
  }

  const handleComplete = async (data: OnboardingData) => {
    completionInFlightRef.current = true;
    try {
      if (import.meta.env.DEV) {
        console.debug("[onboarding] completing with snapshot", {
          monthlyIncomeCents: data.monthlyIncomeCents,
          fixedBills: data.fixedBills,
          monthlySavingsGoalCents: data.monthlySavingsGoalCents,
          wantsWeeklyBudget: data.wantsWeeklyBudget,
          preferredWeeklyBudgetCents: data.preferredWeeklyBudgetCents,
          categories: data.categories,
        });
      }
      await syncFromOnboarding(data);
      complete(data);
      if (import.meta.env.DEV) {
        console.debug("[onboarding] sync complete, navigating to", targetPath);
      }
      navigate(targetPath, { replace: true });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug("[onboarding] completion failed", err);
      }
      toast.error(err instanceof Error ? err.message : "Could not save your setup. Try again.");
    } finally {
      completionInFlightRef.current = false;
    }
  };

  return (
    <OnboardingFlow
      initialData={onboardingData}
      currency={budget?.currency ?? "EUR"}
      onComplete={handleComplete}
    />
  );
}
