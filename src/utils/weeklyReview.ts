import { addDays, differenceInCalendarDays, endOfWeek, isWithinInterval, parseISO, startOfDay, startOfWeek } from "date-fns";
import type { Expense, RecurringBill, SavingsGoal } from "@/types/finance";
import { calculateGoalPlan } from "@/utils/goalPlan";

export interface WeeklyGoalCheck {
  id: string;
  name: string;
  progressPercent: number;
  weeklyNeededCents: number;
}

export interface WeeklyCategorySpend {
  category: string;
  amountCents: number;
  percentage: number;
}

export interface WeeklyReviewData {
  weekStartIso: string;
  weekEndIso: string;
  totalSpentCents: number;
  weeklyBudgetCents: number;
  moneyLeftCents: number;
  safeToSpendCents: number;
  status: "on_track" | "close_to_limit" | "over_budget";
  biggestCategory: WeeklyCategorySpend | null;
  upcomingBills: RecurringBill[];
  goalChecks: WeeklyGoalCheck[];
  suggestion: string;
}

export function getCurrentWeekRange(fromDate = new Date()): { weekStart: Date; weekEnd: Date } {
  const weekStart = startOfWeek(fromDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(fromDate, { weekStartsOn: 1 });
  return { weekStart: startOfDay(weekStart), weekEnd: startOfDay(weekEnd) };
}

export function buildWeeklyReviewData(params: {
  expenses: Expense[];
  recurringBills: RecurringBill[];
  goals: SavingsGoal[];
  monthlyBudgetCents: number;
  safeToSpendCents: number;
  /** When set (e.g. from onboarding weekly cap), overrides the default monthly÷weeks estimate. */
  weeklyBudgetOverrideCents?: number | null;
  today?: Date;
}): WeeklyReviewData {
  const {
    expenses,
    recurringBills,
    goals,
    monthlyBudgetCents,
    safeToSpendCents,
    weeklyBudgetOverrideCents,
    today = new Date(),
  } = params;
  const { weekStart, weekEnd } = getCurrentWeekRange(today);

  const weeklyExpenses = expenses.filter((expense) => {
    const date = startOfDay(parseISO(expense.date));
    return isWithinInterval(date, { start: weekStart, end: weekEnd });
  });

  const totalSpentCents = weeklyExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const weekMonth = weekStart.getMonth();
  const weekYear = weekStart.getFullYear();
  const monthDays = new Date(weekYear, weekMonth + 1, 0).getDate();
  const estimatedWeeksInMonth = Math.max(4, Math.ceil(monthDays / 7));
  const derivedWeeklyBudgetCents =
    monthlyBudgetCents > 0 ? Math.round(monthlyBudgetCents / estimatedWeeksInMonth) : 0;
  const weeklyBudgetCents =
    weeklyBudgetOverrideCents != null && weeklyBudgetOverrideCents > 0
      ? weeklyBudgetOverrideCents
      : derivedWeeklyBudgetCents;
  const moneyLeftCents = weeklyBudgetCents - totalSpentCents;

  const status: WeeklyReviewData["status"] =
    weeklyBudgetCents <= 0
      ? "on_track"
      : totalSpentCents > weeklyBudgetCents
        ? "over_budget"
        : totalSpentCents >= weeklyBudgetCents * 0.85
          ? "close_to_limit"
          : "on_track";

  const byCategory = new Map<string, number>();
  weeklyExpenses.forEach((expense) => {
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amountCents);
  });
  const biggestEntry = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const biggestCategory = biggestEntry
    ? {
        category: biggestEntry[0],
        amountCents: biggestEntry[1],
        percentage: totalSpentCents > 0 ? Math.round((biggestEntry[1] / totalSpentCents) * 100) : 0,
      }
    : null;

  const nextSevenDays = addDays(startOfDay(today), 7);
  const upcomingBills = recurringBills
    .filter((bill) => bill.status === "upcoming")
    .filter((bill) => {
      const due = parseISO(bill.nextDueDate);
      return isWithinInterval(due, { start: startOfDay(today), end: nextSevenDays });
    })
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));

  const activeGoals = goals
    .filter((goal) => goal.savedCents < goal.targetCents)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
    .slice(0, 2);

  const goalChecks: WeeklyGoalCheck[] = activeGoals.map((goal) => {
    const progressPercent = Math.max(0, Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100)));
    const plan = calculateGoalPlan(goal);
    const weeklyNeededCents = Math.max(0, Math.ceil(plan.monthlyRequiredSavingCents / 4));
    return {
      id: goal.id,
      name: goal.name,
      progressPercent,
      weeklyNeededCents,
    };
  });

  const suggestion = buildSuggestion({
    status,
    biggestCategory,
    upcomingBillsTotalCents: upcomingBills.reduce((sum, bill) => sum + bill.amountCents, 0),
    goalChecks,
    weeklyBudgetCents,
    moneyLeftCents,
  });

  return {
    weekStartIso: weekStart.toISOString().slice(0, 10),
    weekEndIso: weekEnd.toISOString().slice(0, 10),
    totalSpentCents,
    weeklyBudgetCents,
    moneyLeftCents,
    safeToSpendCents: Math.max(0, safeToSpendCents),
    status,
    biggestCategory,
    upcomingBills,
    goalChecks,
    suggestion,
  };
}

function buildSuggestion(params: {
  status: WeeklyReviewData["status"];
  biggestCategory: WeeklyCategorySpend | null;
  upcomingBillsTotalCents: number;
  goalChecks: WeeklyGoalCheck[];
  weeklyBudgetCents: number;
  moneyLeftCents: number;
}): string {
  const { status, biggestCategory, upcomingBillsTotalCents, goalChecks, weeklyBudgetCents, moneyLeftCents } = params;

  if (status === "over_budget" && biggestCategory) {
    const reduceBy = Math.max(500, Math.round(biggestCategory.amountCents * 0.1));
    return `You spent more than planned this week. Try reducing ${biggestCategory.category} by around ${reduceBy / 100} next week.`;
  }

  if (upcomingBillsTotalCents > 0 && moneyLeftCents < upcomingBillsTotalCents) {
    const gap = upcomingBillsTotalCents - Math.max(0, moneyLeftCents);
    return `Bills are a bit heavier next week. Lower flexible spending by about ${gap / 100} to stay comfortable.`;
  }

  const goalNeeds = goalChecks.reduce((sum, goal) => sum + goal.weeklyNeededCents, 0);
  if (goalNeeds > 0 && status !== "over_budget") {
    return `To stay on track with your goals, set aside ${goalNeeds / 100} this week.`;
  }

  if (weeklyBudgetCents > 0 && status === "on_track") {
    return "You are on track. Keep your current weekly budget next week.";
  }

  return "Keep adding your expenses this week and your review will get more helpful.";
}

export function daysUntil(dateIso: string, fromDate = new Date()): number {
  return Math.max(0, differenceInCalendarDays(parseISO(dateIso), startOfDay(fromDate)));
}
