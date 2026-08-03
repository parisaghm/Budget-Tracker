import { useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { useBudgetAdjustments } from "@/hooks/useBudgetAdjustments";
import { useClosedCyclesHistory } from "@/hooks/useClosedCyclesHistory";
import { hasSupabaseEnv, supabaseEnvError } from "@/lib/supabase/client";
import { MonthPlanCard } from "@/components/budget/MonthPlanCard";
import { AdjustSavingsSheet } from "@/components/budget/AdjustSavingsSheet";
import { UpcomingBillsCard } from "@/components/UpcomingBillsCard";
import { BillPaymentModals } from "@/components/BillPaymentModals";
import { useBillPaymentDecision } from "@/hooks/useBillPaymentDecision";
import { MonthSpendingTrendCard } from "@/components/dashboard/MonthSpendingTrendCard";
import { TopSpendingCategoriesCard } from "@/components/dashboard/TopSpendingCategoriesCard";
import { GoalsSnapshotCard } from "@/components/dashboard/GoalsSnapshotCard";
import { DashboardInsightsCard } from "@/components/dashboard/DashboardInsightsCard";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { AppShellHeader } from "@/components/AppShellHeader";
import { AppPageContainer } from "@/components/AppPageContainer";
import { CycleRecapDialog } from "@/components/cycle/CycleRecapDialog";
import {
  CycleRecapOfferBanner,
  dismissCycleRecapBanner,
  isCycleRecapBannerDismissed,
} from "@/components/cycle/CycleRecapOfferBanner";
import { buildFinancialPace } from "@/utils/financialPace";
import { buildDashboardInsights } from "@/utils/dashboardInsights";
import { formatMoney, formatMonthNameOnly } from "@/utils/money";
import { NOTIFICATION_SETTINGS_KEY } from "@/utils/notificationPreferences";
import { computeWeeklySafeToSpend, getNextSalaryDateForMonth } from "@/utils/budgetPlanner";
import { usePreviousMonthLeftover } from "@/hooks/usePreviousMonthLeftover";
import { getRolloverBoostBreakdown } from "@/utils/budgetDecisions";
import {
  allocationGoals,
  computePlanPausedBoostCents,
  computePlanReallocationBoostCents,
  resolveAuthoritativeSavingsPlan,
} from "@/utils/savingsAllocation";
import { computeSafeToSpendCents } from "@/utils/safeToSpend";
import { useAdjustSavingsDecision } from "@/hooks/useAdjustSavingsDecision";
import {
  formatIncomeDateLabel,
  getCycleWindowDatesForMonthKey,
  isIncomeCycleConfigured,
} from "@/utils/incomeCycle";
import {
  buildCompletedCycleRecap,
  resolvePlannedSavingsCents,
} from "@/utils/cycleReviewModel";
import {
  budgetMonthKeyFromCycle,
  isDateInBudgetCycle,
} from "@/utils/budgetCycles";
const NOTIFICATION_LOG_KEY = "bt_notification_log_v1";

export default function Dashboard() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const navigate = useNavigate();
  const {
    currentMonth,
    setCurrentMonth,
    getMonthData,
    budget,
    expenses,
    totalSpentCents,
    totalIncomeThisCycleCents,
    hasIncomeForCycle,
    savingsGoalAllocationCents,
    allExpenses,
    addExpense,
    allCategories,
    savingsGoals,
    recurringBills,
    upcomingBills,
    upcomingUnpaidBillsCents,
    incomeCycle,
    selectedCycle,
    budgetCycles,
    categoryLimitsByMonth,
    isLoading,
    markRecurringBillPaid,
    categoryLimitsForMonth,
    reverseContributionFromGoal,
    allocatedThisCycleCents,
    contributionsByGoal,
  } = useSupabaseFinanceData();

  const userId = user?.id ?? (isDemoMode ? "demo" : "");
  const { adjustments, refresh } = useBudgetAdjustments(userId || undefined, currentMonth);

  const [recapOpen, setRecapOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const closedCycles = useMemo(
    () =>
      budgetCycles
        .filter((c) => c.status === "closed")
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [budgetCycles],
  );

  const latestFinishedWithSpend = useMemo(() => {
    for (const cycle of closedCycles) {
      const spent = allExpenses
        .filter((e) => isDateInBudgetCycle(e.date, cycle))
        .reduce((s, e) => s + e.amountCents, 0);
      if (spent > 0) return cycle;
    }
    return null;
  }, [closedCycles, allExpenses]);

  const showRecapBanner =
    Boolean(latestFinishedWithSpend) &&
    !bannerDismissed &&
    latestFinishedWithSpend != null &&
    !isCycleRecapBannerDismissed(latestFinishedWithSpend.id);

  const history = useClosedCyclesHistory({
    userId: isDemoMode ? undefined : userId || undefined,
    closedCycles: latestFinishedWithSpend ? [latestFinishedWithSpend] : [],
  });

  const homeRecap = useMemo(() => {
    if (!latestFinishedWithSpend) return null;
    const cycle = latestFinishedWithSpend;
    const cycleExpenses = allExpenses.filter((e) =>
      isDateInBudgetCycle(e.date, cycle),
    );
    const monthKey = budgetMonthKeyFromCycle(cycle);
    const limits = categoryLimitsByMonth[monthKey] ?? null;
    return buildCompletedCycleRecap({
      cycle,
      expenses: cycleExpenses,
      incomeCents: history.incomeByCycleId[cycle.id] ?? 0,
      incomeEntries: [],
      actualContributionsCents: history.contributionsByCycleId[cycle.id] ?? 0,
      plannedSavingsCents: resolvePlannedSavingsCents(savingsGoals),
      hasContributionsData: cycle.id in history.contributionsByCycleId,
      categoryLimits: limits,
      categories: allCategories,
      isFirstFinishedCycle: closedCycles.length === 1,
    });
  }, [
    latestFinishedWithSpend,
    allExpenses,
    categoryLimitsByMonth,
    history.incomeByCycleId,
    history.contributionsByCycleId,
    savingsGoals,
    allCategories,
    closedCycles.length,
  ]);

  const activeCurrency = budget?.currency ?? "EUR";
  const hasAnyRecurringBills = recurringBills.length > 0;

  const { previousMonthKey } = usePreviousMonthLeftover({
    currentMonth,
    getMonthData,
    recurringBills,
    savingsGoals,
    userId: userId || undefined,
    incomeCycle,
  });

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

  const adjustedSafeToSpend = hasIncomeForCycle
    ? computeSafeToSpendCents({
        incomeForCurrentCycleCents: totalIncomeThisCycleCents,
        spentSoFarCents: totalSpentCents,
        upcomingBillsBeforeIncomeDateCents: upcomingUnpaidBillsCents,
        savingsGoalsForCurrentCycleCents: savingsGoalAllocationCents,
        rolloverBoostCents: adjustments.rolloverBoostCents,
        pausedGoalsBoostCents,
        goalReallocationBoostCents,
      })
    : 0;

  const billPayment = useBillPaymentDecision(
    userId
      ? {
          userId,
          month: currentMonth,
          currency: activeCurrency,
          safeToSpendCents: adjustedSafeToSpend,
          upcomingBills,
          totalSpentCents,
          savingsGoals,
          markRecurringBillPaid,
          onAdjustmentsChanged: refresh,
        }
      : {
          userId: "",
          month: currentMonth,
          currency: activeCurrency,
          safeToSpendCents: adjustedSafeToSpend,
          upcomingBills,
          totalSpentCents,
          savingsGoals,
          markRecurringBillPaid: async () => {},
          onAdjustmentsChanged: refresh,
        },
  );

  const carriedOverLabel = useMemo(() => {
    if (adjustments.rolloverBoostCents <= 0 || !userId) return null;
    const boost = getRolloverBoostBreakdown(userId, currentMonth);
    const amount = formatMoney(adjustments.rolloverBoostCents, activeCurrency);
    if (boost.rolloverDecision?.choice === "add_to_budget") {
      const from = previousMonthKey ? formatMonthNameOnly(previousMonthKey) : "last cycle";
      return `Carried over from ${from}: ${amount}`;
    }
    const primary = boost.lines[0];
    if (primary?.actionType === "rollover_carry") {
      const from = previousMonthKey ? formatMonthNameOnly(previousMonthKey) : "last cycle";
      return `Carried over from ${from}: ${amount}`;
    }
    if (primary) {
      return `Added to this cycle — ${primary.label}: ${amount}`;
    }
    return `Added to this cycle: ${amount}`;
  }, [activeCurrency, adjustments.rolloverBoostCents, currentMonth, previousMonthKey, userId]);

  const weeklySafeToSpend = Math.max(
    0,
    computeWeeklySafeToSpend(adjustedSafeToSpend, new Date(), incomeCycle) -
      adjustments.weeklyReductionCents,
  );

  const financialPace = useMemo(
    () =>
      buildFinancialPace({
        salaryCents: totalIncomeThisCycleCents,
        totalSpentCents,
        leftUntilPaydayCents: adjustedSafeToSpend,
        upcomingBills,
        upcomingBillsCents: upcomingUnpaidBillsCents,
        savingsAllocationCents: savingsGoalAllocationCents,
        expenses: allExpenses,
        currentMonth,
        hasSavingsGoals: savingsGoals.length > 0,
        currency: activeCurrency,
        dailyPaceTargetCents: adjustments.dailyPaceTargetCents,
        incomeCycle,
      }),
    [
      activeCurrency,
      adjustedSafeToSpend,
      allExpenses,
      totalIncomeThisCycleCents,
      currentMonth,
      savingsGoalAllocationCents,
      savingsGoals.length,
      totalSpentCents,
      upcomingBills,
      upcomingUnpaidBillsCents,
      adjustments.dailyPaceTargetCents,
      incomeCycle,
    ],
  );

  const isTightFinances =
    financialPace.emotionalTone === "tight" || financialPace.emotionalTone === "supportive";

  const adjustSavingsCycleLabel = useMemo(() => {
    if (selectedCycle) {
      return `${formatIncomeDateLabel(parseISO(selectedCycle.startDate))} – ${formatIncomeDateLabel(parseISO(selectedCycle.endDate))}`;
    }
    if (isIncomeCycleConfigured(incomeCycle)) {
      const { start, end } = getCycleWindowDatesForMonthKey(incomeCycle, currentMonth);
      return `${formatIncomeDateLabel(start)} – ${formatIncomeDateLabel(end)}`;
    }
    return formatMonthNameOnly(currentMonth);
  }, [currentMonth, incomeCycle, selectedCycle]);

  const adjustSavings = useAdjustSavingsDecision(
    userId && !isDemoMode
      ? {
          userId,
          month: currentMonth,
          currency: activeCurrency,
          safeToSpendCents: adjustedSafeToSpend,
          savingsAllocationCents: savingsGoalAllocationCents,
          pausedGoalsBoostCents,
          goalReallocationBoostCents,
          goals: savingsGoals,
          incomeCycle,
          cycleStartIso: selectedCycle?.startDate ?? null,
          cycleEndIso: selectedCycle?.endDate ?? null,
          cycleId: selectedCycle?.id ?? null,
          onDecided: refresh,
          onTransferBack: reverseContributionFromGoal,
        }
      : {
          userId: userId || "demo",
          month: currentMonth,
          currency: activeCurrency,
          safeToSpendCents: adjustedSafeToSpend,
          savingsAllocationCents: savingsGoalAllocationCents,
          pausedGoalsBoostCents,
          goalReallocationBoostCents,
          goals: savingsGoals,
          incomeCycle,
          cycleStartIso: selectedCycle?.startDate ?? null,
          cycleEndIso: selectedCycle?.endDate ?? null,
          cycleId: selectedCycle?.id ?? null,
          isDemoMode: true,
          onDecided: refresh,
          onTransferBack: async () => {},
        },
  );

  const monthComparisonLabel = useMemo(() => {
    const salary = totalIncomeThisCycleCents;
    if (salary <= 0 || !previousMonthKey) return null;
    const prev = getMonthData(previousMonthKey);
    const prevSalary = prev.budget?.salaryCents ?? 0;
    if (prevSalary <= 0) return null;
    const prevSpent = prev.expenses.reduce((sum, e) => sum + e.amountCents, 0);
    const currentSpentPct = totalSpentCents / salary;
    const prevSpentPct = prevSpent / prevSalary;
    if (prevSpentPct <= 0 || currentSpentPct >= prevSpentPct) return null;
    const improvement = Math.round(((prevSpentPct - currentSpentPct) / prevSpentPct) * 100);
    if (improvement < 3) return null;
    return `↑ ${improvement}% better than ${formatMonthNameOnly(previousMonthKey)}`;
  }, [getMonthData, previousMonthKey, totalIncomeThisCycleCents, totalSpentCents]);

  const previousMonthExpenses = useMemo(() => {
    if (!previousMonthKey) return [];
    return getMonthData(previousMonthKey).expenses;
  }, [getMonthData, previousMonthKey]);

  const dashboardInsights = useMemo(
    () =>
      buildDashboardInsights({
        expenses,
        categories: allCategories,
        categoryLimits: categoryLimitsForMonth,
        financialPace,
        upcomingBills,
        previousMonthExpenses,
        previousMonthKey,
        monthComparisonLabel,
        currency: activeCurrency,
      }),
    [
      activeCurrency,
      allCategories,
      categoryLimitsForMonth,
      expenses,
      financialPace,
      monthComparisonLabel,
      previousMonthExpenses,
      previousMonthKey,
      upcomingBills,
    ],
  );

  const nextIncomeDateLabel = useMemo(() => {
    if (selectedCycle) {
      return formatIncomeDateLabel(parseISO(selectedCycle.endDate));
    }
    const cycleConfigured = isIncomeCycleConfigured(incomeCycle);
    if (cycleConfigured) {
      const { end } = getCycleWindowDatesForMonthKey(incomeCycle, currentMonth);
      return formatIncomeDateLabel(end);
    }
    const nextIncomeDate = parseISO(getNextSalaryDateForMonth(currentMonth, incomeCycle));
    return formatIncomeDateLabel(nextIncomeDate);
  }, [currentMonth, incomeCycle, selectedCycle]);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    let prefs: { weeklyReview?: boolean; upcomingBills?: boolean; goalProgress?: boolean } = {};
    try {
      const prefsRaw = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (!prefsRaw) return;
      prefs = JSON.parse(prefsRaw);
    } catch {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    let log: Record<string, string> = {};
    try {
      log = JSON.parse(localStorage.getItem(NOTIFICATION_LOG_KEY) ?? "{}") as Record<string, string>;
    } catch {
      log = {};
    }

    const maybeNotify = (key: string, title: string, body: string) => {
      if (log[key] === today) return;
      new Notification(title, { body, tag: key, silent: true });
      log[key] = today;
    };

    if (prefs.weeklyReview) {
      maybeNotify(
        "weekly-review",
        "Weekly review check-in",
        "Take 2 minutes to review this week and stay calm.",
      );
    }

    if (prefs.upcomingBills && upcomingBills.length > 0) {
      maybeNotify(
        "upcoming-bills",
        "Upcoming bill reminder",
        `${upcomingBills[0].name} is due soon. Check what's left in this cycle.`,
      );
    }

    if (prefs.goalProgress && savingsGoals.length > 0) {
      maybeNotify(
        "goal-progress",
        "Goal progress reminder",
        "A small contribution this week keeps your goal on track.",
      );
    }

    localStorage.setItem(NOTIFICATION_LOG_KEY, JSON.stringify(log));
  }, [savingsGoals.length, upcomingBills]);

  const hasHomeContent = isDemoMode ? !!budget : true;

  const showInsights =
    dashboardInsights.length > 0 || Boolean(monthComparisonLabel);
  const showBills = Boolean(budget || recurringBills.length > 0);

  const upcomingBillsCard = showBills ? (
    <UpcomingBillsCard
      bills={upcomingBills}
      totalDueBeforeSalaryCents={upcomingUnpaidBillsCents}
      hasAnyRecurringBills={hasAnyRecurringBills}
      currency={activeCurrency}
      maxVisible={1}
      nextIncomeDateLabel={nextIncomeDateLabel}
      onMarkPaid={
        userId && !isDemoMode ? (bill) => void billPayment.requestMarkPaid(bill) : undefined
      }
      markingBillId={billPayment.payingBillId}
    />
  ) : null;

  const insightsCard = showInsights ? (
    <DashboardInsightsCard
      insights={dashboardInsights}
      comparisonLabel={monthComparisonLabel}
      maxVisible={3}
    />
  ) : null;

  return (
    <>
      <Helmet>
        <title>Home · Sova Budget</title>
        <meta
          name="description"
          content="Your financial overview at a glance — safe to spend, spending trends, categories, goals, and upcoming bills."
        />
      </Helmet>

      <div
        className={`dashboard-home min-h-screen bg-background${isTightFinances ? " dashboard-home-tight" : ""}`}
      >
        <AppShellHeader
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          incomeCycle={incomeCycle}
          selectedCycle={selectedCycle}
          currency={activeCurrency}
        />

        <AppPageContainer
          as="main"
          className="space-y-3 pb-mobile-nav pr-mobile-fab pt-3 sm:space-y-4 sm:pt-4 md:pb-8 lg:pt-4"
        >
          {isLoading ? (
            <div className="card-dashboard p-6">
              <p className="text-sm text-muted-foreground">Loading your budget...</p>
            </div>
          ) : null}

          {!hasSupabaseEnv && !isDemoMode ? (
            <div className="card-dashboard p-6">
              <p className="text-sm text-destructive">{supabaseEnvError}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Create a `.env` file from `.env.example` and restart `npm run dev`.
              </p>
            </div>
          ) : null}

          {hasHomeContent ? (
            <div className="dashboard-home-grid">
              {showRecapBanner && latestFinishedWithSpend && homeRecap?.offerable ? (
                <div className="dashboard-home-section col-span-full">
                  <CycleRecapOfferBanner
                    rangeLabel={homeRecap.rangeLabel}
                    onPlay={() => setRecapOpen(true)}
                    onDismiss={() => {
                      dismissCycleRecapBanner(latestFinishedWithSpend.id);
                      setBannerDismissed(true);
                    }}
                  />
                </div>
              ) : null}

              {isDemoMode && !budget ? null : (
                <div className="dashboard-home-section dashboard-home-section--hero">
                  <MonthPlanCard
                    compact
                    currentMonth={currentMonth}
                    currency={activeCurrency}
                    salaryCents={totalIncomeThisCycleCents}
                    fixedBillsCents={upcomingUnpaidBillsCents}
                    savingsAllocationCents={savingsGoalAllocationCents}
                    spentSoFarCents={totalSpentCents}
                    remainingCents={adjustedSafeToSpend}
                    weeklySafeToSpendCents={weeklySafeToSpend}
                    recurringBillsCount={recurringBills.length}
                    pace={hasIncomeForCycle ? financialPace : undefined}
                    incomeCycle={incomeCycle}
                    rolloverBoostCents={adjustments.rolloverBoostCents}
                    pausedGoalsBoostCents={pausedGoalsBoostCents}
                    goalReallocationBoostCents={goalReallocationBoostCents}
                    carriedOverLabel={carriedOverLabel}
                    onAdjustSavings={hasIncomeForCycle ? adjustSavings.openSheet : undefined}
                    hasIncomeForCycle={hasIncomeForCycle}
                    onAddIncome={() => navigate("/budget")}
                  />
                </div>
              )}

              {insightsCard ? (
                <div className="dashboard-home-section dashboard-home-section--insights">
                  {insightsCard}
                </div>
              ) : null}

              {upcomingBillsCard ? (
                <div className="dashboard-home-section dashboard-home-section--bills">
                  {upcomingBillsCard}
                </div>
              ) : null}

              <div className="dashboard-home-section dashboard-home-section--trend">
                <MonthSpendingTrendCard
                  expenses={allExpenses}
                  currentMonth={currentMonth}
                  currency={activeCurrency}
                  incomeCycle={incomeCycle}
                  cycleStartIso={selectedCycle?.startDate}
                  cycleEndIso={selectedCycle?.endDate}
                  calmMode={isTightFinances}
                />
              </div>

              <div className="dashboard-home-section dashboard-home-section--categories">
                <TopSpendingCategoriesCard
                  expenses={expenses}
                  categories={allCategories}
                  currency={activeCurrency}
                />
              </div>

              <div className="dashboard-home-section dashboard-home-section--goals">
                <GoalsSnapshotCard
                  goals={allocationGoals(savingsGoals)}
                  currency={activeCurrency}
                  plannedSavingsCents={
                    authoritativePlan.hasPlan
                      ? Math.max(
                          0,
                          savingsGoalAllocationCents -
                            pausedGoalsBoostCents -
                            goalReallocationBoostCents,
                        )
                      : undefined
                  }
                  allocatedToGoalsCents={
                    authoritativePlan.hasPlan ? allocatedThisCycleCents : undefined
                  }
                />
              </div>
            </div>
          ) : null}
        </AppPageContainer>

        <QuickAddExpenseSheet
          currency={activeCurrency}
          categories={allCategories}
          budgetMonth={currentMonth}
          selectedCycle={selectedCycle}
          onAdd={addExpense}
        />
        <MobileBottomNav />

        {userId && !isDemoMode ? (
          <BillPaymentModals currency={activeCurrency} {...billPayment} />
        ) : null}

        <AdjustSavingsSheet
          {...adjustSavings}
          currency={activeCurrency}
          cycleLabel={adjustSavingsCycleLabel}
        />

        <CycleRecapDialog
          open={recapOpen}
          onOpenChange={setRecapOpen}
          recap={homeRecap}
          currency={activeCurrency}
        />
      </div>
    </>
  );
}
