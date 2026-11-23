import { addDays, format, parseISO, startOfDay } from "date-fns";
import type { BudgetCycle, BudgetCycleStatus, IncomeEntry } from "@/types/budgetCycle";
import type { IncomeCycle } from "@/types/incomeCycle";
import { getNextIncomeDate, isIncomeCycleConfigured } from "@/utils/incomeCycle";
import { defaultExpenseDateForBudgetMonth, getTodayDate } from "@/utils/money";

/** Half-open: start <= date < end */
export function isDateInCycleRange(
  dateYmd: string,
  startYmd: string,
  endYmd: string,
): boolean {
  const d = dateYmd.slice(0, 10);
  return d >= startYmd.slice(0, 10) && d < endYmd.slice(0, 10);
}

export function isDateInBudgetCycle(dateYmd: string, cycle: BudgetCycle): boolean {
  return isDateInCycleRange(dateYmd, cycle.startDate, cycle.endDate);
}

/** Shift a YYYY-MM-DD by `days` using the local calendar (no UTC parseISO shift). */
function shiftLocalYmd(ymd: string, days: number): string {
  const m = ymd.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd.slice(0, 10);
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  return format(dt, "yyyy-MM-dd");
}

/**
 * Default calendar day for a new expense in the selected budget cycle.
 * Uses today when today falls in the cycle (even across a calendar-month
 * boundary); otherwise the cycle start (future) or last inclusive day (past).
 * Falls back to the calendar-month helper when no cycle is available.
 */
export function defaultExpenseDateForBudgetCycle(
  cycle: Pick<BudgetCycle, "startDate" | "endDate"> | null | undefined,
  budgetMonthYm?: string,
  todayYmd: string = getTodayDate(),
): string {
  if (cycle?.startDate && cycle?.endDate) {
    const start = cycle.startDate.slice(0, 10);
    const end = cycle.endDate.slice(0, 10);
    if (isDateInCycleRange(todayYmd, start, end)) return todayYmd;
    if (todayYmd >= end) {
      // Half-open end: last inclusive day is the calendar day before `end`.
      return shiftLocalYmd(end, -1);
    }
    return start;
  }
  const ym = budgetMonthYm?.trim();
  if (ym) return defaultExpenseDateForBudgetMonth(ym);
  return todayYmd;
}

export function scheduleTypeFromIncomeCycle(cycle: IncomeCycle | null | undefined): string {
  if (!isIncomeCycleConfigured(cycle)) return "unconfigured";
  if (cycle.preset === "custom") return `custom:${cycle.day ?? 1}`;
  return cycle.preset;
}

/**
 * Inverse of scheduleTypeFromIncomeCycle. Returns null for non-payday schedule
 * types ("calendar_month", "legacy_month", "unconfigured", unknown values).
 */
export function incomeCycleFromScheduleType(scheduleType: string | null | undefined): IncomeCycle | null {
  if (!scheduleType) return null;
  if (scheduleType === "monthly_1" || scheduleType === "monthly_15" || scheduleType === "monthly_last") {
    return { preset: scheduleType };
  }
  const custom = scheduleType.match(/^custom:(\d{1,2})$/);
  if (custom) {
    const day = Number(custom[1]);
    if (day >= 1 && day <= 31) return { preset: "custom", day };
  }
  return null;
}

/**
 * Window for the cycle that follows `latest` (starts at latest.endDate).
 * Uses the configured schedule; when settings are unavailable it continues the
 * latest frozen cycle's payday schedule instead of falling back to calendar
 * months, so a temporarily-missing schedule can never freeze a "next 1st" end.
 */
export function resolveNextCycleWindow(params: {
  incomeCycle: IncomeCycle | null | undefined;
  latest: Pick<BudgetCycle, "endDate" | "scheduleType">;
}): { startDate: string; endDate: string; scheduleType: string } {
  const startDate = params.latest.endDate.slice(0, 10);
  const schedule = isIncomeCycleConfigured(params.incomeCycle)
    ? params.incomeCycle
    : incomeCycleFromScheduleType(params.latest.scheduleType);

  if (schedule) {
    return {
      startDate,
      endDate: computeCycleEndIso(schedule, startDate),
      scheduleType: scheduleTypeFromIncomeCycle(schedule),
    };
  }

  const start = parseISO(startDate);
  // Next 1st of month strictly after start (transition or calendar month)
  let endDate = format(new Date(start.getFullYear(), start.getMonth() + 1, 1), "yyyy-MM-dd");
  if (endDate <= startDate) {
    endDate = format(new Date(start.getFullYear(), start.getMonth() + 2, 1), "yyyy-MM-dd");
  }
  return { startDate, endDate, scheduleType: "calendar_month" };
}

/**
 * End date (exclusive) for a cycle that starts on `startDate`, using the given schedule.
 * Uses the next payday strictly after start so start Jul 15 + monthly_15 → end Aug 15.
 */
export function computeCycleEndDate(
  schedule: IncomeCycle,
  startDate: Date,
): Date {
  const dayAfterStart = addDays(startOfDay(startDate), 1);
  return startOfDay(getNextIncomeDate(schedule, dayAfterStart));
}

export function computeCycleEndIso(schedule: IncomeCycle, startIso: string): string {
  return format(computeCycleEndDate(schedule, parseISO(startIso)), "yyyy-MM-dd");
}

/** Budget month key from frozen cycle start (YYYY-MM). */
export function budgetMonthKeyFromCycle(cycle: BudgetCycle): string {
  return cycle.startDate.slice(0, 7);
}

export function findCycleForMonthKey(
  cycles: BudgetCycle[],
  monthKey: string,
): BudgetCycle | null {
  const startingInMonth = cycles.filter((c) => budgetMonthKeyFromCycle(c) === monthKey);
  if (startingInMonth.length > 0) {
    // A schedule transition can leave a short stub cycle alongside the real
    // payday cycle in the same start month (e.g. Jun 1–15 and Jun 15–Jul 15).
    // The main cycle for the month is the one with the latest start.
    return [...startingInMonth].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  }
  const probe = `${monthKey}-15`;
  return cycles.find((c) => isDateInBudgetCycle(probe, c)) ?? null;
}

export function findCycleContainingDate(
  cycles: BudgetCycle[],
  dateYmd: string,
): BudgetCycle | null {
  return cycles.find((c) => isDateInBudgetCycle(dateYmd, c)) ?? null;
}

export function findPreviousCycle(
  cycles: BudgetCycle[],
  cycle: BudgetCycle,
): BudgetCycle | null {
  const prior = cycles
    .filter((c) => c.endDate === cycle.startDate || c.endDate <= cycle.startDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  return prior[0] ?? null;
}

export function sumIncomeEntriesCents(entries: IncomeEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amountCents, 0);
}

export function mapBudgetCycleRow(row: {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  status: string;
  schedule_type: string;
  created_at: string;
}): BudgetCycle {
  return {
    id: row.id,
    userId: row.user_id,
    startDate: row.start_date.slice(0, 10),
    endDate: row.end_date.slice(0, 10),
    status: row.status as BudgetCycleStatus,
    scheduleType: row.schedule_type,
    createdAt: row.created_at,
  };
}

export function mapIncomeEntryRow(row: {
  id: string;
  user_id: string;
  cycle_id: string;
  amount_cents: number;
  received_date: string | null;
  source: string | null;
  note: string | null;
  date_is_estimated: boolean;
  legacy_budget_month_id: string | null;
  created_at: string;
}): IncomeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    cycleId: row.cycle_id,
    amountCents: row.amount_cents,
    receivedDate: row.received_date ? row.received_date.slice(0, 10) : null,
    source: row.source,
    note: row.note,
    dateIsEstimated: Boolean(row.date_is_estimated),
    legacyBudgetMonthId: row.legacy_budget_month_id,
    createdAt: row.created_at,
  };
}

export function todayIso(today: Date = new Date()): string {
  return format(startOfDay(today), "yyyy-MM-dd");
}
