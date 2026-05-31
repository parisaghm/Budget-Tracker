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
import { formatMoney, getCurrentMonth } from "@/utils/money";
import { getCurrentWeekRange } from "@/utils/weeklyReview";

export interface WeekPaceDay {
  dateIso: string;
  dayLabel: string;
  amountCents: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export interface WeekPaceData {
  days: WeekPaceDay[];
  spentThisWeekCents: number;
  paceLabel: string;
  insightLine: string;
  hasHistory: boolean;
  typicalWeekCents: number;
  typicalDailyCents: number;
  spentTodayWeekDailyCents: number;
  /** Positive when spent this week exceeds the 4-week average. */
  comparisonDeltaCents: number;
  isOverTypical: boolean;
  maxDayCents: number;
}

/** Anchor date for which Mon–Sun week to show for a selected month. */
export function getWeekAnchorDate(currentMonth: string, today = new Date()): Date {
  const monthStart = startOfMonth(parseISO(`${currentMonth}-01`));
  const calendarMonth = getCurrentMonth();

  if (currentMonth === calendarMonth) {
    return startOfDay(today);
  }
  if (currentMonth < calendarMonth) {
    return startOfDay(endOfMonth(monthStart));
  }
  return monthStart;
}

function sumExpensesForDay(expenses: Expense[], dateIso: string): number {
  return expenses
    .filter((expense) => expense.date.slice(0, 10) === dateIso)
    .reduce((sum, expense) => sum + expense.amountCents, 0);
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

function buildWeekInsight(params: {
  spentThisWeekCents: number;
  typicalWeekCents: number;
  comparisonDeltaCents: number;
  isOverTypical: boolean;
  hasHistory: boolean;
  daysElapsedInWeek: number;
  currency: string;
}): string {
  const {
    spentThisWeekCents,
    typicalWeekCents,
    comparisonDeltaCents,
    isOverTypical,
    hasHistory,
    daysElapsedInWeek,
    currency,
  } = params;

  if (!hasHistory) {
    return "Your usual rhythm will appear after a few weeks of spending.";
  }

  if (spentThisWeekCents === 0 && daysElapsedInWeek > 0) {
    return "You're spending less than your usual pace this week.";
  }

  const absDelta = Math.abs(comparisonDeltaCents);
  if (!isOverTypical && absDelta > 0) {
    return "You're spending less than your usual pace this week.";
  }

  if (isOverTypical) {
    if (comparisonDeltaCents <= typicalWeekCents * 0.15) {
      return "This week is slightly heavier than normal.";
    }
    return "You're spending more than your usual pace this week.";
  }

  return "You're pacing close to your usual week.";
}

function buildPaceLabel(params: {
  days: WeekPaceDay[];
  hasHistory: boolean;
  typicalWeekCents: number;
  viewingCurrentMonth: boolean;
}): string {
  const { days, hasHistory, typicalWeekCents, viewingCurrentMonth } = params;

  if (!hasHistory) {
    return "Your week is starting to take shape.";
  }

  const daysToAnalyze = viewingCurrentMonth ? days.filter((day) => !day.isFuture) : days;
  const daysWithSpending = daysToAnalyze.filter((day) => day.amountCents > 0).length;

  if (daysWithSpending === 0) {
    return viewingCurrentMonth
      ? "A quiet week so far — gentle pace."
      : "Your week is starting to take shape.";
  }

  const typicalDailyCents = typicalWeekCents / 7;
  const quietThreshold = typicalDailyCents * 0.5;
  const heavyThreshold = typicalDailyCents * 1.25;

  const quietDays = daysToAnalyze.filter(
    (day) => day.amountCents > 0 && day.amountCents < quietThreshold,
  ).length;
  const heavyDays = daysToAnalyze.filter(
    (day) => day.amountCents > 0 && day.amountCents > heavyThreshold,
  ).length;

  if (heavyDays === 0) {
    return `${daysWithSpending} small day${daysWithSpending === 1 ? "" : "s"} — gentle pace.`;
  }

  return `${quietDays} quiet day${quietDays === 1 ? "" : "s"}, ${heavyDays} heavier — gentle pace.`;
}

export function buildWeekPaceData(params: {
  expenses: Expense[];
  currentMonth: string;
  currency?: string;
  today?: Date;
}): WeekPaceData {
  const { expenses, currentMonth, currency = "EUR", today = new Date() } = params;
  const actualToday = startOfDay(today);
  const viewingCurrentMonth = currentMonth === getCurrentMonth();
  const anchor = getWeekAnchorDate(currentMonth, actualToday);
  const { weekStart, weekEnd } = getCurrentWeekRange(anchor);
  const dayDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const dayTotals = dayDates.map((day) => sumExpensesForDay(expenses, format(day, "yyyy-MM-dd")));
  const spentThisWeekCents = dayTotals.reduce((sum, value) => sum + value, 0);

  let todayIndex = -1;
  if (viewingCurrentMonth) {
    const todayIso = format(actualToday, "yyyy-MM-dd");
    todayIndex = dayDates.findIndex((day) => format(day, "yyyy-MM-dd") === todayIso);
  }

  const monthIsPast = currentMonth < getCurrentMonth();
  const monthIsFuture = currentMonth > getCurrentMonth();

  const days: WeekPaceDay[] = dayDates.map((day, index) => {
    const dateIso = format(day, "yyyy-MM-dd");
    const dayStart = startOfDay(day);
    const isToday = viewingCurrentMonth && index === todayIndex;
    const isFuture = viewingCurrentMonth
      ? isAfter(dayStart, actualToday)
      : monthIsFuture;
    const isPast = viewingCurrentMonth
      ? isBefore(dayStart, actualToday)
      : monthIsPast;

    return {
      dateIso,
      dayLabel: format(day, "EEE"),
      amountCents: dayTotals[index] ?? 0,
      isToday,
      isPast,
      isFuture,
    };
  });

  const completedWeekTotals: number[] = [];
  for (let weekOffset = 1; weekOffset <= 4; weekOffset += 1) {
    const prevStart = addDays(weekStart, -7 * weekOffset);
    const prevEnd = addDays(weekEnd, -7 * weekOffset);
    completedWeekTotals.push(sumExpensesInRange(expenses, prevStart, prevEnd));
  }

  const historyTotalCents = completedWeekTotals.reduce((sum, value) => sum + value, 0);
  const hasHistory = historyTotalCents > 0;
  const typicalWeekCents = hasHistory
    ? Math.round(completedWeekTotals.reduce((sum, value) => sum + value, 0) / 4)
    : 0;
  const comparisonDeltaCents = spentThisWeekCents - typicalWeekCents;
  const isOverTypical = comparisonDeltaCents > 0;

  const daysElapsedInWeek = viewingCurrentMonth
    ? days.filter((day) => !day.isFuture).length
    : 7;
  const typicalDailyCents = typicalWeekCents > 0 ? Math.round(typicalWeekCents / 7) : 0;
  const spentTodayWeekDailyCents =
    daysElapsedInWeek > 0 ? Math.round(spentThisWeekCents / daysElapsedInWeek) : 0;

  const paceLabel = buildPaceLabel({
    days,
    hasHistory,
    typicalWeekCents,
    viewingCurrentMonth,
  });

  const insightLine = buildWeekInsight({
    spentThisWeekCents,
    typicalWeekCents,
    comparisonDeltaCents,
    isOverTypical,
    hasHistory,
    daysElapsedInWeek,
    currency,
  });

  const maxDayCents = Math.max(...dayTotals, 1);

  return {
    days,
    spentThisWeekCents,
    paceLabel,
    insightLine,
    hasHistory,
    typicalWeekCents,
    typicalDailyCents,
    spentTodayWeekDailyCents,
    comparisonDeltaCents,
    isOverTypical,
    maxDayCents,
  };
}
