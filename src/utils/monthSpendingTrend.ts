import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type { Expense } from "@/types/finance";
import type { IncomeCycle } from "@/types/incomeCycle";
import {
  formatIncomeDateLabel,
  getActiveBudgetMonthKey,
  getCycleWindowDatesForMonthKey,
  isIncomeCycleConfigured,
} from "@/utils/incomeCycle";
import { formatMonthNameOnly } from "@/utils/money";

export type MonthTrendView = "weekly" | "daily";

export interface MonthTrendBucket {
  key: string;
  label: string;
  /** Weekly date range, e.g. "(Jun 15 – 21)". */
  dateRangeLabel?: string;
  amountCents: number;
  isCurrent: boolean;
}

export interface MonthSpendingTrendData {
  buckets: MonthTrendBucket[];
  totalSpentCents: number;
  cycleLabel: string;
  maxBucketCents: number;
  yAxisTicksCents: number[];
  view: MonthTrendView;
}

function sumExpensesInRange(expenses: Expense[], rangeStart: Date, rangeEnd: Date): number {
  const startIso = format(rangeStart, "yyyy-MM-dd");
  const endIso = format(rangeEnd, "yyyy-MM-dd");
  // Half-open: start <= date < end (end is exclusive, matching budget_cycles)
  return expenses
    .filter((expense) => {
      const dateIso = expense.date.slice(0, 10);
      return dateIso >= startIso && dateIso < endIso;
    })
    .reduce((sum, expense) => sum + expense.amountCents, 0);
}

function resolveCycleWindow(
  currentMonth: string,
  incomeCycle: IncomeCycle | null | undefined,
  today: Date,
): { start: Date; end: Date; cycleLabel: string } {
  if (isIncomeCycleConfigured(incomeCycle)) {
    const { start, end } = getCycleWindowDatesForMonthKey(incomeCycle, currentMonth);
    const isActiveCycle = currentMonth === getActiveBudgetMonthKey(incomeCycle, today);
    const windowLabel = `${formatIncomeDateLabel(start)} – ${formatIncomeDateLabel(end)}`;
    return {
      start,
      end,
      cycleLabel: isActiveCycle ? `${windowLabel} (current cycle)` : windowLabel,
    };
  }

  const monthStart = startOfMonth(parseISO(`${currentMonth}-01`));
  const monthEndExclusive = startOfDay(addMonths(monthStart, 1));
  const displayEnd = startOfDay(endOfMonth(monthStart));
  const isActiveCycle = format(today, "yyyy-MM") === currentMonth;
  const windowLabel = `${formatIncomeDateLabel(monthStart)} – ${formatIncomeDateLabel(displayEnd)}`;
  return {
    start: monthStart,
    end: monthEndExclusive,
    cycleLabel: isActiveCycle
      ? `${windowLabel} (current cycle)`
      : `${formatMonthNameOnly(currentMonth)} cycle`,
  };
}

function buildWeeklyBuckets(
  expenses: Expense[],
  cycleStart: Date,
  cycleEnd: Date,
  today: Date,
): MonthTrendBucket[] {
  const buckets: MonthTrendBucket[] = [];
  let weekStart = cycleStart;
  let weekIndex = 1;

  while (!isAfter(weekStart, cycleEnd)) {
    const weekEnd = isBefore(addDays(weekStart, 6), cycleEnd)
      ? addDays(weekStart, 6)
      : cycleEnd;
    const amountCents = sumExpensesInRange(expenses, weekStart, weekEnd);
    const isCurrent = !isAfter(today, weekEnd) && !isBefore(today, weekStart);

    buckets.push({
      key: `w${weekIndex}`,
      label: `W${weekIndex}`,
      dateRangeLabel: `(${formatIncomeDateLabel(weekStart)} – ${formatIncomeDateLabel(weekEnd)})`,
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
  cycleStart: Date,
  cycleEnd: Date,
  today: Date,
): MonthTrendBucket[] {
  const buckets: MonthTrendBucket[] = [];
  let cursor = cycleStart;

  while (!isAfter(cursor, cycleEnd)) {
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

function computeYAxisTicks(maxBucketCents: number): number[] {
  if (maxBucketCents <= 0) {
    return [0, 20000, 40000, 60000, 80000];
  }

  const maxEuros = maxBucketCents / 100;
  const targetSteps = 4;
  const rawStep = maxEuros / targetSteps;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1))));
  const normalized = rawStep / magnitude;
  const niceStep =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const stepEuros = niceStep * magnitude;
  const topEuros = Math.ceil(maxEuros / stepEuros) * stepEuros;
  const ticks: number[] = [];

  for (let value = 0; value <= topEuros + 0.001; value += stepEuros) {
    ticks.push(Math.round(value * 100));
  }

  return ticks.length >= 2 ? ticks : [0, maxBucketCents];
}

export function buildMonthSpendingTrend(params: {
  expenses: Expense[];
  currentMonth: string;
  view?: MonthTrendView;
  incomeCycle?: IncomeCycle | null;
  /** Frozen cycle half-open window from budget_cycles when available. */
  cycleStartIso?: string | null;
  cycleEndIso?: string | null;
  today?: Date;
}): MonthSpendingTrendData {
  const {
    expenses,
    currentMonth,
    view = "weekly",
    incomeCycle = null,
    cycleStartIso = null,
    cycleEndIso = null,
    today = new Date(),
  } = params;
  const actualToday = startOfDay(today);
  const resolved =
    cycleStartIso && cycleEndIso
      ? {
          start: parseISO(cycleStartIso),
          end: parseISO(cycleEndIso),
          cycleLabel: `${formatIncomeDateLabel(parseISO(cycleStartIso))} – ${formatIncomeDateLabel(parseISO(cycleEndIso))}`,
        }
      : resolveCycleWindow(currentMonth, incomeCycle, actualToday);
  const { start: cycleStart, end: cycleEnd, cycleLabel } = resolved;

  const startIso = format(cycleStart, "yyyy-MM-dd");
  const endIso = format(cycleEnd, "yyyy-MM-dd");

  const cycleExpenses = expenses.filter((expense) => {
    const dateIso = expense.date.slice(0, 10);
    return dateIso >= startIso && dateIso < endIso;
  });

  const totalSpentCents = cycleExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);

  let buckets =
    view === "weekly"
      ? buildWeeklyBuckets(cycleExpenses, cycleStart, cycleEnd, actualToday)
      : buildDailyBuckets(cycleExpenses, cycleStart, cycleEnd, actualToday);

  if (view === "daily" && buckets.length > 14) {
    const currentIndex = buckets.findIndex((bucket) => bucket.isCurrent);
    const endIndex = currentIndex >= 0 ? currentIndex + 1 : buckets.length;
    const startIndex = Math.max(0, endIndex - 14);
    buckets = buckets.slice(startIndex, endIndex);
  }

  const maxBucketCents = Math.max(1, ...buckets.map((bucket) => bucket.amountCents));
  const yAxisTicksCents = computeYAxisTicks(maxBucketCents);

  return {
    buckets,
    totalSpentCents,
    cycleLabel,
    maxBucketCents,
    yAxisTicksCents,
    view,
  };
}
