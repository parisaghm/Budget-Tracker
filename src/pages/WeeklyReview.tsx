import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, CheckCircle2, CircleAlert, CircleX, Wallet } from "lucide-react";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { formatMoney, getCurrentMonth } from "@/utils/money";
import { calcSafeToSpend, mergeOnboardingData } from "@/utils/onboarding";
import { buildWeeklyReviewData, daysUntil, getCurrentWeekRange } from "@/utils/weeklyReview";
import { getCategoryLabel } from "@/types/finance";

const statusConfig = {
  on_track: {
    label: "On track",
    icon: CheckCircle2,
    className: "text-emerald-500",
  },
  close_to_limit: {
    label: "Close to limit",
    icon: CircleAlert,
    className: "text-amber-500",
  },
  over_budget: {
    label: "Over budget",
    icon: CircleX,
    className: "text-destructive",
  },
} as const;

export default function WeeklyReviewPage() {
  const {
    getMonthData,
    budget,
    recurringBills,
    savingsGoals,
    safeToSpendCents,
    allCategories,
    addExpense,
    currentMonth,
  } = useSupabaseFinanceData();
  const { onboardingData, isReady: onboardingReady } = useOnboardingProfile();

  const weeklyData = useMemo(() => {
    const now = new Date();
    const { weekStart, weekEnd } = getCurrentWeekRange(now);
    const monthKeys = new Set<string>([weekStart.toISOString().slice(0, 7), weekEnd.toISOString().slice(0, 7)]);

    const mergedExpenses = Array.from(monthKeys).flatMap((month) => getMonthData(month).expenses);
    const profile = mergeOnboardingData(onboardingData);
    const weeklyBudgetOverrideCents =
      onboardingReady && profile.wantsWeeklyBudget
        ? Math.max(0, calcSafeToSpend(profile).recommendedWeeklyCents)
        : null;

    return buildWeeklyReviewData({
      expenses: mergedExpenses,
      recurringBills,
      goals: savingsGoals,
      monthlyBudgetCents: budget?.salaryCents ?? 0,
      safeToSpendCents,
      weeklyBudgetOverrideCents: weeklyBudgetOverrideCents > 0 ? weeklyBudgetOverrideCents : null,
      today: now,
    });
  }, [
    getMonthData,
    recurringBills,
    savingsGoals,
    budget?.salaryCents,
    safeToSpendCents,
    onboardingData,
    onboardingReady,
  ]);

  const hasEnoughData = weeklyData.totalSpentCents > 0 || weeklyData.upcomingBills.length > 0 || weeklyData.goalChecks.length > 0;
  const activeCurrency = budget?.currency ?? "EUR";
  const status = statusConfig[weeklyData.status];
  const StatusIcon = status.icon;
  const budgetProgress = weeklyData.weeklyBudgetCents > 0
    ? Math.min(100, Math.round((weeklyData.totalSpentCents / weeklyData.weeklyBudgetCents) * 100))
    : 0;

  return (
    <>
      <Helmet>
        <title>Weekly Review</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur-xl">
          <div className="container flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md shadow-primary/15 sm:h-12 sm:w-12 sm:shadow-lg sm:shadow-primary/20"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Wallet className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-foreground sm:text-xl">Weekly review</h1>
                <p className="text-xs text-muted-foreground">Monday–Sunday, without the spreadsheet stress</p>
              </div>
            </div>
            <Link
              to="/dashboard"
              className="btn-secondary touch-hit min-h-11 w-full justify-center text-sm sm:w-auto sm:text-xs"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <main className="container max-w-6xl px-4 pb-mobile-nav pt-5 sm:px-6 sm:pt-8 md:pb-10 lg:px-8">
          {!hasEnoughData ? (
            <div className="card-elevated p-8 text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">Not enough data yet</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Add a few expenses this week and your weekly review will appear here.
              </p>
              <Button asChild>
                <Link to="/dashboard">Add expense</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
              <section className="card-elevated order-2 space-y-3 p-4 sm:p-5 lg:order-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Weekly summary</p>
                <h2 className="text-[1.05rem] font-semibold leading-snug sm:text-lg">
                  You spent {formatMoney(weeklyData.totalSpentCents, activeCurrency)} of your{" "}
                  {formatMoney(weeklyData.weeklyBudgetCents, activeCurrency)} weekly budget.
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground sm:text-sm">
                  You have {formatMoney(weeklyData.moneyLeftCents, activeCurrency)} left this week.
                </p>
                <Progress value={budgetProgress} className="h-3 sm:h-2" />
                <div className={`inline-flex items-center gap-2 text-base font-medium sm:text-sm ${status.className}`}>
                  <StatusIcon className="h-5 w-5 sm:h-4 sm:w-4" />
                  {status.label}
                </div>
                <p className="text-xs text-muted-foreground">
                  Week: {format(parseISO(weeklyData.weekStartIso), "MMM d")} – {format(parseISO(weeklyData.weekEndIso), "MMM d")}
                </p>
              </section>

              <section className="card-elevated order-1 space-y-2 border-primary/15 bg-primary/[0.04] p-4 sm:p-5 lg:order-2 dark:bg-primary/[0.07]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Safe to spend</p>
                <h2 className="text-[clamp(1.15rem,4.5vw,1.35rem)] font-semibold leading-snug">
                  {formatMoney(weeklyData.safeToSpendCents, activeCurrency)} left at an easy pace until Sunday.
                </h2>
                <p className="text-base text-muted-foreground sm:text-sm">After upcoming bills and savings.</p>
              </section>

              <section className="card-elevated space-y-2 p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Biggest category</p>
                {weeklyData.biggestCategory ? (
                  <>
                    <h2 className="text-[1.05rem] font-semibold leading-snug sm:text-lg">
                      {getCategoryLabel(weeklyData.biggestCategory.category, allCategories.filter((c) => c.isCustom))}:{" "}
                      {formatMoney(weeklyData.biggestCategory.amountCents, activeCurrency)}.
                    </h2>
                    <p className="text-base text-muted-foreground sm:text-sm">
                      {weeklyData.biggestCategory.percentage}% of this week&apos;s spending.
                    </p>
                  </>
                ) : (
                  <p className="text-base text-muted-foreground sm:text-sm">No category data yet for this week.</p>
                )}
              </section>

              <section className="card-elevated space-y-3 p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Upcoming bills</p>
                {weeklyData.upcomingBills.length === 0 ? (
                  <p className="text-base text-muted-foreground sm:text-sm">No bills due in the next 7 days.</p>
                ) : (
                  <div className="space-y-2">
                    {weeklyData.upcomingBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="flex min-h-[3rem] items-center justify-between gap-3 rounded-xl bg-muted px-3 py-3 text-sm"
                      >
                        <span className="font-medium leading-tight">{bill.name}</span>
                        <span className="shrink-0 text-right text-muted-foreground">
                          {formatMoney(bill.amountCents, activeCurrency)}
                          <span className="block text-xs">in {daysUntil(bill.nextDueDate)}d</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card-elevated space-y-3 p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Goals check</p>
                {weeklyData.goalChecks.length === 0 ? (
                  <p className="text-base text-muted-foreground sm:text-sm">No active savings goals yet.</p>
                ) : (
                  <div className="space-y-3">
                    {weeklyData.goalChecks.map((goal) => (
                      <div key={goal.id} className="rounded-xl bg-muted px-3 py-4">
                        <p className="text-base font-medium sm:text-sm">
                          {goal.name} is {goal.progressPercent}% complete.
                        </p>
                        <Progress value={goal.progressPercent} className="mt-3 h-3 sm:mt-2 sm:h-2" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          {formatMoney(goal.weeklyNeededCents, activeCurrency)} more this week to stay on track.
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card-elevated space-y-3 p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gentle nudge</p>
                <p className="text-base leading-relaxed text-foreground sm:text-sm">{weeklyData.suggestion}</p>
                <div className="inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  One small adjustment is enough.
                </div>
              </section>

              <section className="card-elevated p-4 sm:p-5">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Next step</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button asChild className="h-12 w-full touch-manipulation sm:h-10 sm:w-auto">
                    <Link to="/dashboard" className="inline-flex items-center justify-center gap-1">
                      Plan next week
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="h-12 w-full touch-manipulation sm:h-10 sm:w-auto">
                    <Link to={`/report/${getCurrentMonth()}`}>Review transactions</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 w-full touch-manipulation sm:h-10 sm:w-auto">
                    <Link to="/dashboard">Add expense</Link>
                  </Button>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
      <QuickAddExpenseSheet
        currency={activeCurrency}
        categories={allCategories}
        budgetMonth={currentMonth}
        onAdd={addExpense}
      />
      <MobileBottomNav />
    </>
  );
}
