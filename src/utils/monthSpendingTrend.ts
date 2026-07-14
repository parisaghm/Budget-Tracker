import {
  addDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type { Expense } from "@/types/finance";
import { formatMonthNameOnly } from "@/utils/money";

export type MonthTrendView = "weekly" | "daily";

export interface MonthTrendBucket {
  key: string;
  label: string;
  amountCents: number;
  isCurrent: boolean;
}

export interface MonthSpendingTrendData {
  buckets: MonthTrendBucket[];
  totalSpentCents: number;
  monthLabel: string;
  maxBucketCents: number;
  view: MonthTrendView;
}

function sumExpensesInRange(expenses: Expense[], rangeStart: Date, rangeEnd: Date): number {
  const startIso = format(rangeStart, "yyyy-MM-dd");
  const endIso = format(rangeEnd, "yyyy-MM-dd");
  return expenses
    .filter((expense) => {
      const dateIso = expense.date.slice(0, 10);
      return dateIso >= startIso && dateIso <= endIso;
    })
    .reduce((sum, expense) => sum + expense.amountCents, 0);
}

function buildWeeklyBuckets(
  expenses: Expense[],
  monthStart: Date,
  monthEnd: Date,
  today: Date,
): MonthTrendBucket[] {
  const buckets: MonthTrendBucket[] = [];
  let weekStart = monthStart;
  let weekIndex = 1;

  while (!isAfter(weekStart, monthEnd)) {
    const weekEnd = isBefore(addDays(weekStart, 6), monthEnd)
      ? addDays(weekStart, 6)
      : monthEnd;
    const amountCents = sumExpensesInRange(expenses, weekStart, weekEnd);
    const isCurrent =
      !isAfter(today, weekEnd) && !isBefore(today, weekStart);

    buckets.push({
      key: `w${weekIndex}`,
      label: `W${weekIndex}`,
      amountCents,
      isCurrent,
    });

    weekStart = addDays(weekEnd, 1);
    weekIndex += 1;
  }

  return buckets;
}

function buildDailyBuckets(
  expenses: Expense[],
  monthStart: Date,
  monthEnd: Date,
  today: Date,
): MonthTrendBucket[] {
  const buckets: MonthTrendBucket[] = [];
  let cursor = monthStart;

  while (!isAfter(cursor, monthEnd)) {
    const dateIso = format(cursor, "yyyy-MM-dd");
    const amountCents = expenses
      .filter((expense) => expense.date.slice(0, 10) === dateIso)
      .reduce((sum, expense) => sum + expense.amountCents, 0);

    buckets.push({
      key: dateIso,
      label: format(cursor, "d"),
      amountCents,
      isCurrent: format(cursor, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"),
    });

    cursor = addDays(cursor, 1);
  }

  return buckets;
}

export function buildMonthSpendingTrend(params: {
  expenses: Expense[];
  currentMonth: string;
  view?: MonthTrendView;
  today?: Date;
}): MonthSpendingTrendData {
  const { expenses, currentMonth, view = "weekly", today = new Date() } = params;
  const monthStart = startOfMonth(parseISO(`${currentMonth}-01`));
  const monthEnd = startOfDay(endOfMonth(monthStart));
  const actualToday = startOfDay(today);

  const monthExpenses = expenses.filter((expense) => {
    const dateIso = expense.date.slice(0, 10);
    const startIso = format(monthStart, "yyyy-MM-dd");
    const endIso = format(monthEnd, "yyyy-MM-dd");
    return dateIso >= startIso && dateIso <= endIso;
  });

  const totalSpentCents = monthExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);

  let buckets =
    view === "weekly"
      ? buildWeeklyBuckets(monthExpenses, monthStart, monthEnd, actualToday)
      : buildDailyBuckets(monthExpenses, monthStart, monthEnd, actualToday);

  if (view === "daily" && buckets.length > 14) {
    const currentIndex = buckets.findIndex((bucket) => bucket.isCurrent);
    const endIndex = currentIndex >= 0 ? currentIndex + 1 : buckets.length;
    const startIndex = Math.max(0, endIndex - 14);
    buckets = buckets.slice(startIndex, endIndex);
  }

  const maxBucketCents = Math.max(1, ...buckets.map((bucket) => bucket.amountCents));

  return {
    buckets,
    totalSpentCents,
    monthLabel: formatMonthNameOnly(currentMonth),
    maxBucketCents,
    view,
  };
}
