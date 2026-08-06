import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useBudgetAdjustments } from "@/hooks/useBudgetAdjustments";
import { useClosedCyclesHistory } from "@/hooks/useClosedCyclesHistory";
import { AppShellHeader } from "@/components/AppShellHeader";
import { AppPageContainer } from "@/components/AppPageContainer";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { CycleReviewHero } from "@/components/cycle/CycleReviewHero";
import { MoneyFlowCard } from "@/components/cycle/MoneyFlowCard";
import { CycleSpendingPaceCard } from "@/components/cycle/CycleSpendingPaceCard";
import { CycleComparisonCard } from "@/components/cycle/CycleComparisonCard";
import { FinishedCyclesCard } from "@/components/cycle/FinishedCyclesCard";
import { CycleWatchList } from "@/components/cycle/CycleWatchList";
import { CycleRecapDialog } from "@/components/cycle/CycleRecapDialog";
import {
  buildCompletedCycleRecap,
  buildCycleReviewModel,
  resolvePlannedSavingsCents,
} from "@/utils/cycleReviewModel";
import { budgetMonthKeyFromCycle, isDateInBudgetCycle } from "@/utils/budgetCycles";
import {
  computePlanPausedBoostCents,
  computePlanReallocationBoostCents,
} from "@/utils/savingsAllocation";
import { computeSafeToSpendCents } from "@/utils/safeToSpend";

export default function CyclePage() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const {
    currentMonth,
    setCurrentMonth,
    budget,
    displayCurrency,
    expenses,
    allExpenses,
    totalSpentCents,
    totalIncomeThisCycleCents,
    incomeEntries,
    selectedCycle,
    budgetCycles,
    addExpense,
    allCategories,
    categoryLimitsForMonth,
    categoryLimitsByMonth,
    savingsGoals,
    savingsGoalAllocationCents,
    allocatedThisCycleCents,
    contributionsByGoal,
    upcomingBills,
    upcomingUnpaidBillsCents,
    recurringBills,
    incomeCycle,
  } = useSupabaseFinanceData();

  const userId = user?.id ?? (isDemoMode ? "demo" : undefined);
  const { adjustments } = useBudgetAdjustments(userId, currentMonth);
  const activeCurrency = displayCurrency;
  const todayYmd = format(new Date(), "yyyy-MM-dd");

  const [showAllFinished, setShowAllFinished] = useState(false);
  const [recapCycleId, setRecapCycleId] = useState<string | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);

  const closedCycles = useMemo(
    () =>
      budgetCycles
        .filter((c) => c.status === "closed")
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [budgetCycles],
  );

  const history = useClosedCyclesHistory({
    userId: isDemoMode ? undefined : userId,
    closedCycles,
  });

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

  const adjustedSafeToSpend = useMemo(() => {
    if (totalIncomeThisCycleCents <= 0) return 0;
    return computeSafeToSpendCents({
      incomeForCurrentCycleCents: totalIncomeThisCycleCents,
      spentSoFarCents: totalSpentCents,
      upcomingBillsBeforeIncomeDateCents: upcomingUnpaidBillsCents,
      savingsGoalsForCurrentCycleCents: savingsGoalAllocationCents,
      rolloverBoostCents: adjustments.rolloverBoostCents,
      pausedGoalsBoostCents,
      goalReallocationBoostCents,
    });
  }, [
    totalIncomeThisCycleCents,
    totalSpentCents,
    upcomingUnpaidBillsCents,
    savingsGoalAllocationCents,
    adjustments.rolloverBoostCents,
    pausedGoalsBoostCents,
    goalReallocationBoostCents,
  ]);

  const plannedSavingsCents = resolvePlannedSavingsCents(savingsGoals);

  const model = useMemo(() => {
    if (!selectedCycle) return null;
    return buildCycleReviewModel({
      selectedCycle,
      budgetCycles,
      homeSpentCents: totalSpentCents,
      homeSafeToSpendCents: adjustedSafeToSpend,
      todayYmd,
      incomeReceivedCents: totalIncomeThisCycleCents,
      incomeEntries: incomeEntries ?? [],
      cycleExpensesList: expenses,
      allExpenses,
      categories: allCategories,
      categoryLimits: categoryLimitsForMonth,
      recurringBills,
      upcomingBills,
      savingsGoals,
      plannedSavingsCents,
      allocatedToGoalsCents: allocatedThisCycleCents,
      contributionsByGoal,
      contributionsByCycleId: history.contributionsByCycleId,
      incomeByCycleId: history.incomeByCycleId,
      categoryLimitsByMonth,
      finishedListLimit: showAllFinished ? 50 : 5,
    });
  }, [
    selectedCycle,
    budgetCycles,
    totalSpentCents,
    adjustedSafeToSpend,
    todayYmd,
    totalIncomeThisCycleCents,
    incomeEntries,
    expenses,
    allExpenses,
    allCategories,
    categoryLimitsForMonth,
    recurringBills,
    upcomingBills,
    savingsGoals,
    plannedSavingsCents,
    allocatedThisCycleCents,
    contributionsByGoal,
    history.contributionsByCycleId,
    history.incomeByCycleId,
    categoryLimitsByMonth,
    showAllFinished,
  ]);

  const recap = useMemo(() => {
    if (!recapCycleId) return null;
    const cycle = budgetCycles.find((c) => c.id === recapCycleId);
    if (!cycle || cycle.status !== "closed") return null;

    const cycleExpenses = allExpenses.filter((e) =>
      isDateInBudgetCycle(e.date, cycle),
    );
    const monthKey = budgetMonthKeyFromCycle(cycle);
    const limits = categoryLimitsByMonth[monthKey] ?? null;
    const hasContributionsData = cycle.id in history.contributionsByCycleId;

    return buildCompletedCycleRecap({
      cycle,
      expenses: cycleExpenses,
      incomeCents: history.incomeByCycleId[cycle.id] ?? 0,
      incomeEntries: [],
      actualContributionsCents: history.contributionsByCycleId[cycle.id] ?? 0,
      plannedSavingsCents,
      hasContributionsData,
      categoryLimits: limits,
      categories: allCategories,
      isFirstFinishedCycle: closedCycles.length === 1,
    });
  }, [
    recapCycleId,
    budgetCycles,
    allExpenses,
    categoryLimitsByMonth,
    history.contributionsByCycleId,
    history.incomeByCycleId,
    plannedSavingsCents,
    allCategories,
    closedCycles.length,
  ]);

  const openRecap = (cycleId: string | null) => {
    if (!cycleId) {
      setRecapCycleId(null);
      setRecapOpen(true);
      return;
    }
    setRecapCycleId(cycleId);
    setRecapOpen(true);
  };

  return (
    <>
      <Helmet>
        <title>Cycle · Sova</title>
      </Helmet>

      <div className="flex min-h-dvh flex-col bg-background">
        <AppShellHeader
          title="Cycle"
          subtitle="Progress, reflection, and recap"
          currency={activeCurrency}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          incomeCycle={incomeCycle}
          selectedCycle={selectedCycle}
        />

        <AppPageContainer
          as="main"
          className="flex-1 space-y-4 pb-mobile-nav pr-mobile-fab pt-4 sm:space-y-5 sm:pt-5 md:pb-10 lg:pt-6"
        >
          {!selectedCycle ? (
            <section className="card-dashboard rounded-[1.5rem] border border-border p-6">
              <h1 className="font-display text-xl font-semibold">Cycle review</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                No budget cycle is selected yet. Set up your income cycle to start
                reviewing progress.
              </p>
            </section>
          ) : !model ? null : (
            <>
              <CycleReviewHero
                hero={model.hero}
                actualSpentCents={model.actualSpentCents}
                safeToSpendCents={model.safeToSpendCents}
                plannedSavingsCents={model.plannedSavingsCents}
                actualContributionsCents={model.actualContributionsCents}
                currency={activeCurrency}
                onPlayRecap={openRecap}
              />

              <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
                <div className="order-2 space-y-4 lg:order-1">
                  <MoneyFlowCard model={model.moneyFlow} currency={activeCurrency} />
                  <CycleSpendingPaceCard pace={model.pace} currency={activeCurrency} />
                  <CycleComparisonCard
                    model={model.comparison}
                    currency={activeCurrency}
                  />
                  <div className="lg:hidden">
                    <FinishedCyclesCard
                      cycles={model.finishedCycles}
                      totalCount={model.finishedTotalCount}
                      currency={activeCurrency}
                      showAll={showAllFinished}
                      onToggleShowAll={() => setShowAllFinished((v) => !v)}
                      onPlayRecap={(id) => openRecap(id)}
                    />
                  </div>
                </div>

                <div className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-24">
                  <div className="hidden lg:block">
                    <FinishedCyclesCard
                      cycles={model.finishedCycles}
                      totalCount={model.finishedTotalCount}
                      currency={activeCurrency}
                      showAll={showAllFinished}
                      onToggleShowAll={() => setShowAllFinished((v) => !v)}
                      onPlayRecap={(id) => openRecap(id)}
                    />
                  </div>
                  <CycleWatchList
                    title={model.watchTitle}
                    items={model.watchItems}
                    currency={activeCurrency}
                  />
                </div>
              </div>
            </>
          )}
        </AppPageContainer>

        <MobileBottomNav />
        <QuickAddExpenseSheet
          currency={activeCurrency}
          categories={allCategories}
          budgetMonth={currentMonth}
          selectedCycle={selectedCycle}
          onAdd={addExpense}
        />
      </div>

      <CycleRecapDialog
        open={recapOpen}
        onOpenChange={setRecapOpen}
        recap={recap}
        currency={activeCurrency}
      />
    </>
  );
}
