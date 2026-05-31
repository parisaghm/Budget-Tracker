import { useEffect, useMemo } from 'react';

import { Helmet } from 'react-helmet-async';

import { useSupabaseFinanceData } from '@/hooks/useSupabaseFinanceData';

import { useAuth } from '@/context/AuthContext';

import { useDemo } from '@/context/DemoContext';

import { useBudgetAdjustments } from '@/hooks/useBudgetAdjustments';

import { hasSupabaseEnv, supabaseEnvError } from '@/lib/supabase/client';

import { MonthPlanCard } from '@/components/budget/MonthPlanCard';

import { UpcomingBillsCard } from '@/components/UpcomingBillsCard';

import { WeekPaceCard } from '@/components/dashboard/WeekPaceCard';

import { MobileBottomNav } from '@/components/MobileBottomNav';

import { QuickAddExpenseSheet } from '@/components/QuickAddExpenseSheet';

import { AppShellHeader, appShellMaxWidthClass } from '@/components/AppShellHeader';

import { NextStepCard, resolveNextStep } from '@/components/budget/NextStepCard';

import { buildFinancialPace } from '@/utils/financialPace';
import { formatMoney, formatMonthNameOnly } from '@/utils/money';

import { NOTIFICATION_SETTINGS_KEY } from '@/utils/notificationPreferences';

import { computeWeeklySafeToSpend } from '@/utils/budgetPlanner';

import { usePreviousMonthLeftover } from '@/hooks/usePreviousMonthLeftover';

import { shouldShowOverspendGuidance, shouldShowRolloverPrompt, getRolloverBoostBreakdown } from '@/utils/budgetDecisions';
import { getPausedGoalsAllocationCents } from '@/utils/paceSupport';
import { computeSafeToSpendCents } from '@/utils/safeToSpend';



const NOTIFICATION_LOG_KEY = 'bt_notification_log_v1';



export default function Dashboard() {

  const { user } = useAuth();

  const { isDemoMode } = useDemo();

  const {

    currentMonth,

    setCurrentMonth,

    getMonthData,

    budget,

    totalSpentCents,

    safeToSpendCents,

    savingsGoalAllocationCents,

    allExpenses,

    addExpense,

    addContributionToGoal,

    allCategories,

    savingsGoals,

    recurringBills,

    upcomingBills,

    upcomingUnpaidBillsCents,

    incomeCycle,

    isLoading,

  } = useSupabaseFinanceData();



  const userId = user?.id ?? (isDemoMode ? 'demo' : '');

  const { adjustments, rolloverDecision, overspendDecision, refresh } = useBudgetAdjustments(

    userId || undefined,

    currentMonth,

  );



  const activeCurrency = budget?.currency ?? 'EUR';

  const hasAnyRecurringBills = recurringBills.length > 0;

  const { previousMonthKey, previousLeftoverCents } = usePreviousMonthLeftover({

    currentMonth,

    getMonthData,

    recurringBills,

    savingsGoals,

    userId: userId || undefined,

    incomeCycle,

  });



  const pausedGoalsBoostCents = useMemo(
    () => getPausedGoalsAllocationCents(savingsGoals, adjustments.pausedGoalIds),
    [adjustments.pausedGoalIds, savingsGoals],
  );

  const adjustedSafeToSpend = computeSafeToSpendCents({
    incomeForCurrentCycleCents: budget?.salaryCents ?? 0,
    spentSoFarCents: totalSpentCents,
    upcomingBillsBeforeIncomeDateCents: upcomingUnpaidBillsCents,
    savingsGoalsForCurrentCycleCents: savingsGoalAllocationCents,
    rolloverBoostCents: adjustments.rolloverBoostCents,
    pausedGoalsBoostCents,
  });

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
  }, [
    activeCurrency,
    adjustments.rolloverBoostCents,
    currentMonth,
    previousMonthKey,
    userId,
  ]);

  const weeklySafeToSpend = Math.max(

    0,

    computeWeeklySafeToSpend(adjustedSafeToSpend, new Date(), incomeCycle) -
      adjustments.weeklyReductionCents,

  );



  const showRollover = shouldShowRolloverPrompt(previousLeftoverCents, rolloverDecision);

  const showOverspend = shouldShowOverspendGuidance(safeToSpendCents, overspendDecision);

  const overAmountCents = Math.abs(Math.min(0, safeToSpendCents));



  const financialPace = useMemo(

    () =>

      buildFinancialPace({

        salaryCents: budget?.salaryCents ?? 0,

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

      budget?.salaryCents,

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

    financialPace.emotionalTone === 'tight' || financialPace.emotionalTone === 'supportive';

  const monthComparisonLabel = useMemo(() => {
    const salary = budget?.salaryCents ?? 0;
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
  }, [budget?.salaryCents, getMonthData, previousMonthKey, totalSpentCents]);



  const nextStep = useMemo(

    () =>

      resolveNextStep({

        hasBudget: (budget?.salaryCents ?? 0) > 0,

        showRollover,

        showOverspend,

        upcomingBillsCount: upcomingBills.length,

        leftUntilPaydayCents: adjustedSafeToSpend,

        currency: activeCurrency,

        leftoverCents: previousLeftoverCents,

        previousMonthKey,

        pace: financialPace,

      }),

    [

      activeCurrency,

      adjustedSafeToSpend,

      budget?.salaryCents,

      financialPace,

      previousLeftoverCents,

      previousMonthKey,

      showOverspend,

      showRollover,

      upcomingBills.length,

    ],

  );



  useEffect(() => {

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

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

      log = JSON.parse(localStorage.getItem(NOTIFICATION_LOG_KEY) ?? '{}') as Record<string, string>;

    } catch {

      log = {};

    }



    const maybeNotify = (key: string, title: string, body: string) => {

      if (log[key] === today) return;

      new Notification(title, { body, tag: key, silent: true });

      log[key] = today;

    };



    if (prefs.weeklyReview) {

      maybeNotify('weekly-review', 'Weekly review check-in', 'Take 2 minutes to review this week and stay calm.');

    }

    if (prefs.upcomingBills && upcomingBills.length > 0) {

      maybeNotify(

        'upcoming-bills',

        'Upcoming bill reminder',

        `${upcomingBills[0].name} is due soon. Check what's left in this cycle.`,

      );

    }

    if (prefs.goalProgress && savingsGoals.length > 0) {

      maybeNotify('goal-progress', 'Goal progress reminder', 'A small contribution this week keeps your goal on track.');

    }



    localStorage.setItem(NOTIFICATION_LOG_KEY, JSON.stringify(log));

  }, [savingsGoals.length, upcomingBills]);



  const hasHomeContent = isDemoMode ? !!budget : (budget?.salaryCents ?? 0) > 0 || recurringBills.length > 0;



  return (

    <>

      <Helmet>

        <title>Home · Sova Budget</title>

        <meta

          name="description"

          content="Your financial pace at a glance — what's left in this cycle, gentle guidance, and upcoming bills."

        />

      </Helmet>



      <div

        className={`dashboard-home min-h-screen bg-background${isTightFinances ? ' dashboard-home-tight' : ''}`}

      >

        <AppShellHeader

          currentMonth={currentMonth}

          onMonthChange={setCurrentMonth}

          currency={activeCurrency}

          contentMaxWidth={appShellMaxWidthClass}

        />



        <main

          className={`container ${appShellMaxWidthClass} space-y-5 px-5 pb-mobile-nav pr-mobile-fab pt-4 sm:space-y-6 sm:px-7 sm:pt-5 md:pb-10 md:pr-4 lg:px-9 lg:pt-6`}

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

            <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:gap-8">

              {isDemoMode && !budget ? null : (

                <MonthPlanCard

                  compact

                  currentMonth={currentMonth}

                  currency={activeCurrency}

                  salaryCents={budget?.salaryCents ?? 0}

                  fixedBillsCents={upcomingUnpaidBillsCents}

                  savingsAllocationCents={savingsGoalAllocationCents}

                  spentSoFarCents={totalSpentCents}

                  remainingCents={adjustedSafeToSpend}

                  weeklySafeToSpendCents={weeklySafeToSpend}

                  recurringBillsCount={recurringBills.length}

                  pace={financialPace}

                  incomeCycle={incomeCycle}

                  monthComparisonLabel={monthComparisonLabel}

                  rolloverBoostCents={adjustments.rolloverBoostCents}

                  pausedGoalsBoostCents={pausedGoalsBoostCents}

                  carriedOverLabel={carriedOverLabel}

                />

              )}



              {nextStep.kind !== 'on_track' ? (
                <NextStepCard
                  step={nextStep}
                  rolloverContext={
                    showRollover && userId
                      ? {
                          userId,
                          month: currentMonth,
                          leftoverCents: previousLeftoverCents,
                          monthlyIncomeCents: budget?.salaryCents ?? 0,
                          currency: activeCurrency,
                          previousMonthKey,
                          goals: savingsGoals,
                          onContribution: addContributionToGoal,
                          onDecided: refresh,
                        }
                      : undefined
                  }
                  overspendContext={
                    showOverspend && userId
                      ? {
                          userId,
                          month: currentMonth,
                          overAmountCents,
                          safeToSpendCents: adjustedSafeToSpend,
                          monthlyIncomeCents: budget?.salaryCents ?? 0,
                          previousLeftoverCents,
                          currency: activeCurrency,
                          onDecided: refresh,
                        }
                      : undefined
                  }
                  paceSupportContext={
                    nextStep.kind === 'pace_support' && userId
                      ? {
                          userId,
                          month: currentMonth,
                          currency: activeCurrency,
                          leftUntilPaydayCents: adjustedSafeToSpend,
                          daysToSalary: financialPace.daysUntilPayday,
                          currentDailyPaceCents: financialPace.typicalDailySpendCents,
                          goals: savingsGoals,
                          onDecided: refresh,
                        }
                      : undefined
                  }
                />
              ) : null}



              <WeekPaceCard

                expenses={allExpenses}

                currentMonth={currentMonth}

                currency={activeCurrency}

                calmMode={isTightFinances}

              />



              {budget || recurringBills.length > 0 ? (

                <UpcomingBillsCard

                  bills={upcomingBills}

                  totalDueBeforeSalaryCents={upcomingUnpaidBillsCents}

                  hasAnyRecurringBills={hasAnyRecurringBills}

                  currency={activeCurrency}

                />

              ) : null}

            </div>

          ) : null}

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

