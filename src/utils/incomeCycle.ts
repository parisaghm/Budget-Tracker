import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDaysInMonth,
  parseISO,
  setDate,
  startOfDay,
  startOfMonth,
} from "date-fns";
import {
  isIncomeCyclePreset,
  type IncomeCycle,
  type IncomeCyclePreset,
} from "@/types/incomeCycle";

export function isIncomeCycleConfigured(cycle: IncomeCycle | null | undefined): cycle is IncomeCycle {
  if (!cycle?.preset || !isIncomeCyclePreset(cycle.preset)) return false;
  if (cycle.preset === "custom") {
    return typeof cycle.day === "number" && cycle.day >= 1 && cycle.day <= 31;
  }
  return true;
}

/** True when daily pace should follow the calendar month (1st → month end). */
export function usesCalendarMonthForPace(cycle: IncomeCycle | null | undefined): boolean {
  return cycle?.preset === "monthly_1";
}

function clampDayOfMonth(year: number, monthIndex: number, day: number): number {
  return Math.min(Math.max(1, Math.floor(day)), getDaysInMonth(new Date(year, monthIndex, 1)));
}

function dateOnDayOfMonth(year: number, monthIndex: number, day: number): Date {
  return startOfDay(setDate(new Date(year, monthIndex, 1), clampDayOfMonth(year, monthIndex, day)));
}

function lastCalendarDayOfMonth(year: number, monthIndex: number): Date {
  return startOfDay(endOfMonth(new Date(year, monthIndex, 1)));
}

function resolveMonthlyDay(cycle: IncomeCycle): number {
  switch (cycle.preset) {
    case "monthly_1":
      return 1;
    case "monthly_15":
      return 15;
    case "custom":
      return cycle.day ?? 1;
    default:
      return cycle.day ?? 1;
  }
}

function monthlyIncomeDateForMonth(cycle: IncomeCycle, year: number, monthIndex: number): Date {
  if (cycle.preset === "monthly_last") {
    return lastCalendarDayOfMonth(year, monthIndex);
  }
  return dateOnDayOfMonth(year, monthIndex, resolveMonthlyDay(cycle));
}

/** Next income date strictly on or after `today` (local calendar). */
export function getNextIncomeDate(cycle: IncomeCycle, today: Date = new Date()): Date {
  const ref = startOfDay(today);
  const onThisMonth = monthlyIncomeDateForMonth(cycle, ref.getFullYear(), ref.getMonth());
  if (onThisMonth >= ref) return onThisMonth;

  const nextMonth = addMonths(startOfMonth(ref), 1);
  return monthlyIncomeDateForMonth(cycle, nextMonth.getFullYear(), nextMonth.getMonth());
}

/** Most recent income date on or before `today`. */
export function getPreviousIncomeDate(cycle: IncomeCycle, today: Date = new Date()): Date {
  const ref = startOfDay(today);
  const onThisMonth = monthlyIncomeDateForMonth(cycle, ref.getFullYear(), ref.getMonth());
  if (onThisMonth <= ref) return onThisMonth;

  const prevMonth = addMonths(startOfMonth(ref), -1);
  return monthlyIncomeDateForMonth(cycle, prevMonth.getFullYear(), prevMonth.getMonth());
}

export function getNextIncomeDateIso(cycle: IncomeCycle, today: Date = new Date()): string {
  return format(getNextIncomeDate(cycle, today), "yyyy-MM-dd");
}

export function getDaysUntilNextIncome(cycle: IncomeCycle, today: Date = new Date()): number {
  const ref = startOfDay(today);
  const next = getNextIncomeDate(cycle, ref);
  return Math.max(0, differenceInCalendarDays(next, ref));
}

/** Days left in the current budget cycle (for pace). */
export function getDaysRemainingInCycle(cycle: IncomeCycle, today: Date = new Date()): number {
  if (usesCalendarMonthForPace(cycle)) {
    const ref = startOfDay(today);
    const end = endOfMonth(ref);
    return Math.max(0, differenceInCalendarDays(end, ref) + 1);
  }
  return getDaysUntilNextIncome(cycle, today);
}

export function getActiveCycleWindow(
  cycle: IncomeCycle,
  today: Date = new Date(),
): { start: Date; end: Date } {
  const ref = startOfDay(today);
  const end = getNextIncomeDate(cycle, ref);
  const start = getPreviousIncomeDate(cycle, ref);
  return { start, end };
}

/** Budget month key (YYYY-MM) for the income cycle that contains `today`. */
export function getActiveBudgetMonthKey(
  cycle: IncomeCycle,
  today: Date = new Date(),
): string {
  const { start } = getActiveCycleWindow(cycle, today);
  return format(start, "yyyy-MM");
}

/** Bill / plan window for a selected budget month (YYYY-MM). */
export function getCycleWindowForMonthKey(
  cycle: IncomeCycle,
  monthKey: string,
): { startIso: string; endIso: string } {
  const monthEnd = endOfMonth(parseISO(`${monthKey}-01`));
  const { start, end } = getActiveCycleWindow(cycle, monthEnd);
  return {
    startIso: format(start, "yyyy-MM-dd"),
    endIso: format(end, "yyyy-MM-dd"),
  };
}

export function getCycleWindowDatesForMonthKey(
  cycle: IncomeCycle,
  monthKey: string,
): { start: Date; end: Date } {
  const { startIso, endIso } = getCycleWindowForMonthKey(cycle, monthKey);
  return { start: parseISO(startIso), end: parseISO(endIso) };
}

export function formatCycleWindowShort(cycle: IncomeCycle, monthKey: string): string {
  const { start, end } = getCycleWindowDatesForMonthKey(cycle, monthKey);
  return `${formatIncomeDateLabel(start)} – ${formatIncomeDateLabel(end)}`;
}

export function formatBudgetMonthSelectorLabel(
  cycle: IncomeCycle,
  monthKey: string,
  today: Date = new Date(),
): string {
  const windowLabel = formatCycleWindowShort(cycle, monthKey);
  const isActive = monthKey === getActiveBudgetMonthKey(cycle, today);
  return isActive ? `Current cycle · ${windowLabel}` : windowLabel;
}

export function getDaysElapsedInCycle(cycle: IncomeCycle, today: Date = new Date()): number {
  const ref = startOfDay(today);
  if (usesCalendarMonthForPace(cycle)) {
    const monthStart = startOfMonth(ref);
    return Math.max(1, differenceInCalendarDays(ref, monthStart) + 1);
  }
  const { start } = getActiveCycleWindow(cycle, ref);
  return Math.max(1, differenceInCalendarDays(ref, start) + 1);
}

export function getWeeksRemainingInCycle(cycle: IncomeCycle, fromDate = new Date()): number {
  const daysLeft = getDaysRemainingInCycle(cycle, fromDate);
  return Math.max(1, Math.ceil(daysLeft / 7));
}

/** Legacy helper — calendar month end when no cycle is configured. */
export function getDefaultNextIncomeDateForMonth(monthKey: string): string {
  const start = startOfMonth(parseISO(`${monthKey}-01`));
  return format(addMonths(start, 1), "yyyy-MM-dd");
}

export function formatIncomeDateLabel(date: Date): string {
  return format(date, "MMM d");
}

export function presetToIncomeCycle(preset: IncomeCyclePreset, day?: number): IncomeCycle {
  if (preset === "custom") {
    return { preset, day: day ?? 1 };
  }
  return { preset };
}
