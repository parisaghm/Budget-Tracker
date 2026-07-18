import { addDays, format, parseISO, startOfDay } from "date-fns";
import type { BudgetCycle, BudgetCycleStatus, IncomeEntry } from "@/types/budgetCycle";
import type { IncomeCycle } from "@/types/incomeCycle";
import { getNextIncomeDate, isIncomeCycleConfigured } from "@/utils/incomeCycle";

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

export function scheduleTypeFromIncomeCycle(cycle: IncomeCycle | null | undefined): string {
  if (!isIncomeCycleConfigured(cycle)) return "unconfigured";
  if (cycle.preset === "custom") return `custom:${cycle.day ?? 1}`;
  return cycle.preset;
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
