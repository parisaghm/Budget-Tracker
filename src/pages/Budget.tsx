import { useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, List, Target } from "lucide-react";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { useBudgetAdjustments } from "@/hooks/useBudgetAdjustments";
import { AppShellHeader } from "@/components/AppShellHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { SalarySetup, type SalarySetupHandle } from "@/components/SalarySetup";
import { RolloverPrompt } from "@/components/budget/RolloverPrompt";
import { OverspendGuidance } from "@/components/budget/OverspendGuidance";
import { MoneyFlowBreakdown } from "@/components/budget/MoneyFlowBreakdown";
import { MonthPlanCard } from "@/components/budget/MonthPlanCard";
import { SpendingCategoriesCard } from "@/components/budget/SpendingCategoriesCard";
import { SavingsGoalsCard } from "@/components/budget/SavingsGoalsCard";
import { ResetMonthPlanButton } from "@/components/budget/ResetMonthPlanButton";
import { buildMonthBudgetPlan, computeWeeklySafeToSpend } from "@/utils/budgetPlanner";
import { usePreviousMonthLeftover } from "@/hooks/usePreviousMonthLeftover";
import { shouldShowOverspendGuidance, shouldShowRolloverPrompt } from "@/utils/budgetDecisions";
import { cn } from "@/lib/utils";

export default function BudgetPage() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const salarySetupRef = useRef<SalarySetupHandle>(null);
  const [showSalaryEditor, setShowSalaryEditor] = useState(false);
  const {
    currentMonth,
    setCurrentMonth,
    getMonthData,
    budget,
    expenses,
    totalSpentCents,
    safeToSpendCents,
    upcomingUnpaidBillsCents,
    savingsGoalAllocationCents,
    savingsGoals,
    addContributionToGoal,
    setSalary,
    addExpense,
    allCategories,
    recurringBills,
    categoryLimitsForMonth,
    setCategoryLimit,
    incomeCycle,
  } = useSupabaseFinanceData();

  const userId = user?.id ?? (isDemoMode ? "demo" : "");
  const { adjustments, rolloverDecision, overspendDecision, refresh } = useBudgetAdjustments(
    userId || undefined,
    currentMonth,
  );

  const activeCurrency = budget?.currency ?? "EUR";
  const { previousMonthKey, previousLeftoverCents } = usePreviousMonthLeftover({
    currentMonth,
    getMonthData,
    recurringBills,
    savingsGoals,
    userId: userId || undefined,
    incomeCycle,
  });

  const adjustedSafeToSpend = safeToSpendCents + adjustments.rolloverBoostCents;
  const plan = useMemo(
    () =>
      buildMonthBudgetPlan({
        salaryCents: budget?.salaryCents ?? 0,
        rolloverBoostCents: adjustments.rolloverBoostCents,
        fixedBillsCents: upcomingUnpaidBillsCents,
        savingsAllocationCents: savingsGoalAllocationCents,
        spentSoFarCents: totalSpentCents,
        incomeCycle,
      }),
    [
      adjustments.rolloverBoostCents,
      budget?.salaryCents,
      incomeCycle,
      savingsGoalAllocationCents,
      totalSpentCents,
      upcomingUnpaidBillsCents,
    ],
  );

  const weeklySafeToSpend = Math.max(
    0,
    computeWeeklySafeToSpend(adjustedSafeToSpend, new Date(), incomeCycle) -
      adjustments.weeklyReductionCents,
  );

  const showRollover = shouldShowRolloverPrompt(previousLeftoverCents, rolloverDecision);
  const showOverspend = shouldShowOverspendGuidance(safeToSpendCents, overspendDecision);
  const overAmountCents = Math.abs(Math.min(0, safeToSpendCents));
  const rolloverPending = previousLeftoverCents > 0 && !rolloverDecision && plan.rolloverBoostCents === 0;

  const secondaryLinks = [
    { to: `/report/${currentMonth}`, label: "Monthly report", icon: FileText },
    { to: "/expenses", label: "Expenses & categories", icon: List },
    { to: "/goals", label: "Savings goals", icon: Target },
  ];

  return (
    <>
      <Helmet>
        <title>Budget · Sova Budget</title>
        <meta name="description" content="See where your money goes this month." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <AppShellHeader
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          currency={activeCurrency}
          contentMaxWidth="max-w-6xl"
        />
        <main className="container max-w-6xl space-y-5 px-4 pb-mobile-nav pr-mobile-fab pt-5 sm:px-6 sm:pt-6 md:pb-10 md:pr-4 lg:px-8 lg:pt-8">
          {!isDemoMode ? (
            <div
              className={cn(
                "card-elevated p-4",
                (budget?.salaryCents ?? 0) > 0 && !showSalaryEditor && "hidden",
              )}
            >
              <p className="label-caps mb-3">Monthly income</p>
              <SalarySetup
                ref={salarySetupRef}
                embedded
                currentSalaryCents={budget?.salaryCents || null}
                incomeNote={budget?.incomeNote ?? null}
                currency={activeCurrency}
                onSave={(cents, note) => {
                  setSalary(cents, note);
                  setShowSalaryEditor(false);
                }}
              />
            </div>
          ) : null}

          {showRollover && userId ? (
            <div id="rollover">
              <RolloverPrompt
                userId={userId}
                month={currentMonth}
                leftoverCents={previousLeftoverCents}
                monthlyIncomeCents={budget?.salaryCents ?? 0}
                currency={activeCurrency}
                goals={savingsGoals}
                onContribution={addContributionToGoal}
                onDecided={refresh}
              />
            </div>
          ) : null}

          {showOverspend && userId ? (
            <div id="overspend">
              <OverspendGuidance
                userId={userId}
                month={currentMonth}
                overAmountCents={overAmountCents}
                safeToSpendCents={adjustedSafeToSpend}
                monthlyIncomeCents={budget?.salaryCents ?? 0}
                previousLeftoverCents={previousLeftoverCents}
                currency={activeCurrency}
                onDecided={refresh}
              />
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6 xl:gap-8">
            <div className="space-y-5">
              <MonthPlanCard
                currentMonth={currentMonth}
                currency={activeCurrency}
                salaryCents={plan.monthlyIncomeCents}
                fixedBillsCents={plan.fixedBillsCents}
                savingsAllocationCents={plan.savingsAllocationCents}
                spentSoFarCents={plan.spentSoFarCents}
                remainingCents={adjustedSafeToSpend}
                weeklySafeToSpendCents={weeklySafeToSpend}
                recurringBillsCount={recurringBills.length}
                onAdjust={
                  !isDemoMode
                    ? () => {
                        setShowSalaryEditor(true);
                        requestAnimationFrame(() => salarySetupRef.current?.openEdit());
                      }
                    : undefined
                }
                incomeCycle={incomeCycle}
              />

              <SavingsGoalsCard
                goals={savingsGoals}
                savingsAllocationCents={plan.savingsAllocationCents}
                currency={activeCurrency}
              />
            </div>

            <SpendingCategoriesCard
              expenses={expenses}
              categories={allCategories}
              currency={activeCurrency}
              categoryLimits={categoryLimitsForMonth}
              onSetCategoryLimit={setCategoryLimit}
            />
          </div>

          <MoneyFlowBreakdown
            plan={plan}
            currency={activeCurrency}
            previousMonthKey={previousMonthKey}
            previousLeftoverCents={previousLeftoverCents}
            rolloverPending={rolloverPending}
            adjustedSafeToSpendCents={adjustedSafeToSpend}
            weeklySafeToSpendCents={weeklySafeToSpend}
            weeklyReductionCents={adjustments.weeklyReductionCents}
            recurringBillsCount={recurringBills.length}
          />

          {userId ? (
            <div className="card-elevated space-y-3 p-5">
              <div>
                <p className="label-caps">Restore plan</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  If numbers look wrong after a choice, reset recalculates this month from your income,
                  bills, goals, and spending — without deleting anything.
                </p>
              </div>
              <ResetMonthPlanButton
                userId={userId}
                month={currentMonth}
                onReset={refresh}
                className="w-full rounded-full"
              />
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-3">
            {secondaryLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="card-elevated flex min-h-[4.5rem] flex-col justify-between gap-2 p-4 transition-colors hover:bg-muted/30"
              >
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </div>
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
