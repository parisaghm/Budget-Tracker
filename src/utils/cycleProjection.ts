import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import type { Expense } from "@/types/finance";
import type { BudgetCycle } from "@/types/budgetCycle";
import { isDateInBudgetCycle } from "@/utils/budgetCycles";

export interface CycleDayProgress {
  cycleLength: number;
  /** 1-based day index within the cycle, clamped to [1, cycleLength] when in/after cycle. */
  cycleDay: number;
  /** Days elapsed used for pace (same as cycleDay when in progress). */
  elapsedDays: number;
  remainingDays: number;
  /** Raw ratio elapsedDays / cycleLength (not clamped for status). */
  elapsedRatio: number;
  /** Display percent 0–100. */
  elapsedPercentDisplay: number;
  isBeforeCycle: boolean;
  isAfterCycle: boolean;
}

export function computeCycleDayProgress(
  cycle: BudgetCycle,
  todayYmd: string,
): CycleDayProgress {
  const start = startOfDay(parseISO(cycle.startDate.slice(0, 10)));
  const end = startOfDay(parseISO(cycle.endDate.slice(0, 10)));
  const today = startOfDay(parseISO(todayYmd.slice(0, 10)));
  const cycleLength = Math.max(1, differenceInCalendarDays(end, start));

  const isBeforeCycle = today < start;
  const isAfterCycle = today >= end;

  let cycleDay: number;
  if (isBeforeCycle) {
    cycleDay = 0;
  } else if (isAfterCycle) {
    cycleDay = cycleLength;
  } else {
    cycleDay = Math.min(
      cycleLength,
      Math.max(1, differenceInCalendarDays(today, start) + 1),
    );
  }

  const elapsedDays = cycleDay;
  const remainingDays = Math.max(cycleLength - cycleDay, 0);
  const elapsedRatio = cycleLength > 0 ? elapsedDays / cycleLength : 0;
  const elapsedPercentDisplay = Math.min(100, Math.max(0, Math.round(elapsedRatio * 100)));

  return {
    cycleLength,
    cycleDay,
    elapsedDays,
    remainingDays,
    elapsedRatio,
    elapsedPercentDisplay,
    isBeforeCycle,
    isAfterCycle,
  };
}

export type ProjectionKind = "none" | "early_estimate" | "projected";

export interface CycleProjectionResult {
  kind: ProjectionKind;
  /** Null when kind is none or division unsafe. */
  projectedSpendCents: number | null;
  label: string | null;
}

/**
 * Project end-of-cycle spend from pace so far.
 * - Day 0 / elapsedDays <= 0: no projection
 * - Day 1: early estimate (if any spend)
 * - Day >= 2: full projection
 * Never divides by zero.
 */
export function projectCycleSpend(params: {
  actualSpentCents: number;
  elapsedDays: number;
  cycleLength: number;
}): CycleProjectionResult {
  const { actualSpentCents, elapsedDays, cycleLength } = params;

  if (elapsedDays <= 0 || cycleLength <= 0) {
    return { kind: "none", projectedSpendCents: null, label: null };
  }

  const projected = Math.round((actualSpentCents / elapsedDays) * cycleLength);

  if (elapsedDays === 1) {
    return {
      kind: "early_estimate",
      projectedSpendCents: projected,
      label: "early estimate",
    };
  }

  return {
    kind: "projected",
    projectedSpendCents: projected,
    label: null,
  };
}

export interface CumulativePoint {
  dateYmd: string;
  dayIndex: number;
  cumulativeActualCents: number | null;
  cumulativeProjectedCents: number | null;
  isToday: boolean;
}

export interface CumulativeSeries {
  points: CumulativePoint[];
  actualTodayCents: number;
  largestOneOff: { dateYmd: string; amountCents: number; label: string } | null;
}

/**
 * Build cumulative spending series for selected-cycle dates.
 * Actual line up to today (or cycle end if closed); projected dashed from today to end.
 */
export function buildCumulativeSpendingSeries(params: {
  cycle: BudgetCycle;
  expenses: Expense[];
  todayYmd: string;
  projection: CycleProjectionResult;
}): CumulativeSeries {
  const { cycle, expenses, todayYmd, projection } = params;
  const start = startOfDay(parseISO(cycle.startDate.slice(0, 10)));
  const end = startOfDay(parseISO(cycle.endDate.slice(0, 10)));
  const cycleLength = Math.max(1, differenceInCalendarDays(end, start));

  const progress = computeCycleDayProgress(cycle, todayYmd);
  const todayIndex = progress.isBeforeCycle
    ? 0
    : progress.isAfterCycle
      ? cycleLength
      : progress.cycleDay;

  const byDate = new Map<string, number>();
  for (const exp of expenses) {
    if (!isDateInBudgetCycle(exp.date, cycle)) continue;
    const d = exp.date.slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + exp.amountCents);
  }

  let largestOneOff: CumulativeSeries["largestOneOff"] = null;
  for (const exp of expenses) {
    if (!isDateInBudgetCycle(exp.date, cycle)) continue;
    if (
      !largestOneOff ||
      exp.amountCents > largestOneOff.amountCents
    ) {
      largestOneOff = {
        dateYmd: exp.date.slice(0, 10),
        amountCents: exp.amountCents,
        label: exp.note?.trim() || exp.category,
      };
    }
  }

  const points: CumulativePoint[] = [];
  let running = 0;
  const actualAtToday =
    expenses
      .filter((e) => {
        const d = e.date.slice(0, 10);
        return (
          isDateInBudgetCycle(e.date, cycle) &&
          (progress.isAfterCycle || d <= todayYmd.slice(0, 10))
        );
      })
      .reduce((s, e) => s + e.amountCents, 0);

  for (let i = 1; i <= cycleLength; i++) {
    const date = addDays(start, i - 1);
    const dateYmd = format(date, "yyyy-MM-dd");
    running += byDate.get(dateYmd) ?? 0;

    const isToday = i === todayIndex && !progress.isBeforeCycle;
    const inActualWindow = progress.isAfterCycle || i <= todayIndex;

    let cumulativeProjectedCents: number | null = null;
    if (
      projection.projectedSpendCents != null &&
      todayIndex > 0 &&
      i >= todayIndex
    ) {
      const remainingSpan = cycleLength - todayIndex;
      if (remainingSpan <= 0) {
        cumulativeProjectedCents = projection.projectedSpendCents;
      } else {
        const t = (i - todayIndex) / remainingSpan;
        cumulativeProjectedCents = Math.round(
          actualAtToday + t * (projection.projectedSpendCents - actualAtToday),
        );
      }
    }

    points.push({
      dateYmd,
      dayIndex: i,
      cumulativeActualCents: inActualWindow ? running : null,
      cumulativeProjectedCents:
        i === todayIndex
          ? actualAtToday
          : i > todayIndex
            ? cumulativeProjectedCents
            : null,
      isToday,
    });
  }

  return {
    points,
    actualTodayCents: actualAtToday,
    largestOneOff:
      largestOneOff && largestOneOff.amountCents > 0 ? largestOneOff : null,
  };
}

/** Day index (1-based) of a YMD date within a cycle, or null if outside. */
export function dayIndexInCycle(cycle: BudgetCycle, dateYmd: string): number | null {
  if (!isDateInBudgetCycle(dateYmd, cycle)) return null;
  const start = startOfDay(parseISO(cycle.startDate.slice(0, 10)));
  const date = startOfDay(parseISO(dateYmd.slice(0, 10)));
  return differenceInCalendarDays(date, start) + 1;
}

/** Sum expenses in a cycle with day index <= maxDay (like-for-like). */
export function sumSpendThroughDay(
  cycle: BudgetCycle,
  expenses: Expense[],
  maxDay: number,
): number {
  return expenses
    .filter((e) => {
      const idx = dayIndexInCycle(cycle, e.date);
      return idx != null && idx <= maxDay;
    })
    .reduce((s, e) => s + e.amountCents, 0);
}

export function clampPercentDisplay(ratio: number | null): number | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  return Math.min(999, Math.max(0, Math.round(ratio * 100)));
}
