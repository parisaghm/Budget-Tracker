import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDay,
  getDaysInMonth,
  isWeekend,
  parseISO,
  setDate,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import type { IncomeCycle, IncomeCyclePreset } from "@/types/incomeCycle";

export function isIncomeCycleConfigured(cycle: IncomeCycle | null | undefined): cycle is IncomeCycle {
  if (!cycle?.preset) return false;
  if (cycle.preset === "custom") {
    return typeof cycle.day === "number" && cycle.day >= 1 && cycle.day <= 31;
  }
  if (cycle.preset === "biweekly" || cycle.preset === "weekly") {
    return Boolean(cycle.anchorDate && /^\d{4}-\d{2}-\d{2}$/.test(cycle.anchorDate));
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

function lastBusinessDayOfMonth(year: number, monthIndex: number): Date {
  let cursor = lastCalendarDayOfMonth(year, monthIndex);
  while (isWeekend(cursor)) {
    cursor = subDays(cursor, 1);
  }
  return cursor;
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
  switch (cycle.preset) {
    case "monthly_last":
      return lastCalendarDayOfMonth(year, monthIndex);
    case "monthly_last_business":
      return lastBusinessDayOfMonth(year, monthIndex);
    default:
      return dateOnDayOfMonth(year, monthIndex, resolveMonthlyDay(cycle));
  }
}

function isMonthlyPreset(preset: IncomeCyclePreset): boolean {
  return (
    preset === "monthly_1" ||
    preset === "monthly_15" ||
    preset === "monthly_last" ||
    preset === "monthly_last_business" ||
    preset === "custom"
  );
}

/** Next income date strictly on or after `today` (local calendar). */
export function getNextIncomeDate(cycle: IncomeCycle, today: Date = new Date()): Date {
  const ref = startOfDay(today);

  if (isMonthlyPreset(cycle.preset)) {
    const onThisMonth = monthlyIncomeDateForMonth(cycle, ref.getFullYear(), ref.getMonth());
    if (onThisMonth >= ref) return onThisMonth;

    const nextMonth = addMonths(startOfMonth(ref), 1);
    return monthlyIncomeDateForMonth(cycle, nextMonth.getFullYear(), nextMonth.getMonth());
  }

  const anchorIso = cycle.anchorDate;
  if (!anchorIso) return ref;

  const anchor = startOfDay(parseISO(anchorIso));
  const stepDays = cycle.preset === "weekly" ? 7 : 14;

  if (ref <= anchor) return anchor;

  const daysSince = differenceInCalendarDays(ref, anchor);
  const periods = Math.ceil(daysSince / stepDays);
  return addDays(anchor, periods * stepDays);
}

/** Most recent income date on or before `today`. */
export function getPreviousIncomeDate(cycle: IncomeCycle, today: Date = new Date()): Date {
  const ref = startOfDay(today);

  if (isMonthlyPreset(cycle.preset)) {
    const onThisMonth = monthlyIncomeDateForMonth(cycle, ref.getFullYear(), ref.getMonth());
    if (onThisMonth <= ref) return onThisMonth;

    const prevMonth = addMonths(startOfMonth(ref), -1);
    return monthlyIncomeDateForMonth(cycle, prevMonth.getFullYear(), prevMonth.getMonth());
  }

  const anchorIso = cycle.anchorDate;
  if (!anchorIso) return ref;

  const anchor = startOfDay(parseISO(anchorIso));
  const stepDays = cycle.preset === "weekly" ? 7 : 14;

  if (ref < anchor) return anchor;

  const daysSince = differenceInCalendarDays(ref, anchor);
  const periods = Math.floor(daysSince / stepDays);
  return addDays(anchor, periods * stepDays);
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

export function presetToIncomeCycle(preset: IncomeCyclePreset, day?: number, anchorDate?: string): IncomeCycle {
  if (preset === "custom") {
    return { preset, day: day ?? 1 };
  }
  if (preset === "biweekly" || preset === "weekly") {
    return { preset, anchorDate };
  }
  return { preset };
}

/** Suggested anchor when switching to weekly / biweekly (nearest past weekday). */
export function defaultIncomeAnchorDate(today: Date = new Date()): string {
  let cursor = startOfDay(today);
  while (getDay(cursor) === 0 || getDay(cursor) === 6) {
    cursor = subDays(cursor, 1);
  }
  return format(cursor, "yyyy-MM-dd");
}
