import { Helmet } from "react-helmet-async";
import { useMemo } from "react";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useBudgetAdjustments } from "@/hooks/useBudgetAdjustments";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { AppShellHeader } from "@/components/AppShellHeader";
import { AppPageContainer } from "@/components/AppPageContainer";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { SavingsGoals } from "@/components/SavingsGoals";
import {
  computeAvailableToAllocateCents,
  computePlannedSavingsCents,
  computePlanPausedBoostCents,
  computePlanReallocationBoostCents,
  resolveAuthoritativeSavingsPlan,
} from "@/utils/savingsAllocation";
import { toast } from "sonner";

export default function GoalsPage() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const { onboardingData } = useOnboardingProfile();
  const {
    currentMonth,
    setCurrentMonth,
    budget,
    displayCurrency,
    savingsGoals,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    addExpense,
    allCategories,
    incomeCycle,
    selectedCycle,
    contributionsByGoal,
    allocatedThisCycleCents,
    saveCycleAllocation,
    isSavingCycleAllocation,
  } = useSupabaseFinanceData();

  const userId = user?.id ?? (isDemoMode ? "demo" : "");
  const { adjustments } = useBudgetAdjustments(userId || undefined, currentMonth);
  const activeCurrency = displayCurrency;

  const authoritativePlan = useMemo(
    () => resolveAuthoritativeSavingsPlan(savingsGoals),
    [savingsGoals],
  );

  const pausedGoalsBoostCents = useMemo(
    () =>
      computePlanPausedBoostCents({
        goals: savingsGoals,
        pausedGoalIds: adjustments.pausedGoalIds,
        allocatedThisCycleByGoal: contributionsByGoal,
      }),
    [adjustments.pausedGoalIds, contributionsByGoal, savingsGoals],
  );
  const goalReallocationBoostCents = useMemo(
    () =>
      computePlanReallocationBoostCents({
        goals: savingsGoals,
        goalReallocationCents: adjustments.goalReallocationCents,
      }),
    [adjustments.goalReallocationCents, savingsGoals],
  );

  const plannedSavingsCents = useMemo(
    () =>
      computePlannedSavingsCents({
        goals: savingsGoals,
        allocatedThisCycleByGoal: contributionsByGoal,
        pausedGoalsBoostCents,
        goalReallocationBoostCents,
      }),
    [
      contributionsByGoal,
      goalReallocationBoostCents,
      pausedGoalsBoostCents,
      savingsGoals,
    ],
  );

  const availableToAllocateCents = computeAvailableToAllocateCents(
    plannedSavingsCents,
    allocatedThisCycleCents,
  );

  const canAllocate = Boolean(selectedCycle?.id) && !isDemoMode;

  return (
    <>
      <Helmet>
        <title>Goals · Sova Budget</title>
        <meta name="description" content="Track savings goals at your own pace." />
      </Helmet>
      <div className="flex min-h-dvh flex-col bg-background">
        <AppShellHeader
          title="Goals"
          subtitle="Save toward what matters"
          currency={activeCurrency}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          incomeCycle={incomeCycle}
        />
        <AppPageContainer
          as="main"
          className="flex-1 pb-mobile-nav pr-mobile-fab pt-5 sm:pt-8 md:pb-10"
        >
          <div className="mx-auto w-full max-w-2xl">
            <SavingsGoals
              goals={savingsGoals}
              currency={activeCurrency}
              hasSavingsPlan={authoritativePlan.hasPlan}
              plannedSavingsCents={plannedSavingsCents}
              allocatedThisCycleCents={allocatedThisCycleCents}
              availableToAllocateCents={availableToAllocateCents}
              contributionsByGoal={contributionsByGoal}
              canAllocate={canAllocate}
              isSavingAllocation={isSavingCycleAllocation}
              suggestedPlanMonthlyCents={onboardingData.monthlySavingsGoalCents}
              onSaveAllocation={async (payload) => {
                if (isDemoMode) {
                  toast.info("Sample budget", {
                    description: "Sign in to allocate savings to goals.",
                  });
                  return;
                }
                if (!authoritativePlan.hasPlan) {
                  toast.error("Savings plan not set", {
                    description: "Set your monthly savings plan before allocating.",
                  });
                  return;
                }
                await saveCycleAllocation.mutateAsync(payload);
              }}
              onAddGoal={addSavingsGoal}
              onUpdateGoal={updateSavingsGoal}
              onDeleteGoal={deleteSavingsGoal}
            />
          </div>
        </AppPageContainer>
        <QuickAddExpenseSheet
          currency={activeCurrency}
          categories={allCategories}
          budgetMonth={currentMonth}
          selectedCycle={selectedCycle}
          onAdd={addExpense}
        />
        <MobileBottomNav />
      </div>
    </>
  );
}
