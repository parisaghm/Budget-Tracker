import { Helmet } from "react-helmet-async";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useBudgetAdjustments } from "@/hooks/useBudgetAdjustments";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { AppShellHeader } from "@/components/AppShellHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { SavingsGoals } from "@/components/SavingsGoals";

export default function GoalsPage() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const {
    currentMonth,
    setCurrentMonth,
    budget,
    remainingCents,
    savingsGoals,
    addSavingsGoal,
    addContributionToGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    addExpense,
    allCategories,
    incomeCycle,
  } = useSupabaseFinanceData();

  const userId = user?.id ?? (isDemoMode ? "demo" : "");
  const { adjustments } = useBudgetAdjustments(userId || undefined, currentMonth);
  const activeCurrency = budget?.currency ?? "EUR";
  const adjustedRemaining = remainingCents + adjustments.rolloverBoostCents;

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
          contentMaxWidth="max-w-2xl"
        />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pr-mobile-fab pt-5 sm:px-6 sm:pt-8 md:pr-4 lg:px-8">
          <SavingsGoals
            goals={savingsGoals}
            remainingCents={adjustedRemaining}
            currency={activeCurrency}
            onAddGoal={addSavingsGoal}
            onAddContribution={addContributionToGoal}
            onUpdateGoal={updateSavingsGoal}
            onDeleteGoal={deleteSavingsGoal}
          />
        </main>
        <QuickAddExpenseSheet
          currency={activeCurrency}
          categories={allCategories}
          budgetMonth={currentMonth}
          onAdd={addExpense}
        />
        <MobileBottomNav />
      </div>
    </>
  );
}
