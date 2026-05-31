import { addMonths, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import type { BudgetMonth, Expense, RecurringBill, SavingsGoal } from "@/types/finance";
import type { IncomeCycle } from "@/types/incomeCycle";
import { getMonthAdjustments } from "@/utils/budgetDecisions";
import { calculateGoalPlan } from "@/utils/goalPlan";
import {
  getCycleWindowForMonthKey,
  getDefaultNextIncomeDateForMonth,
  getNextIncomeDateIso,
  getWeeksRemainingInCycle,
  isIncomeCycleConfigured,
} from "@/utils/incomeCycle";
import { getUpcomingBills } from "@/utils/recurringBills";
import { computeSafeToSpendCents } from "@/utils/safeToSpend";

export interface MonthBudgetPlan {
  monthlyIncomeCents: number;
  rolloverBoostCents: number;
  effectiveIncomeCents: number;
  fixedBillsCents: number;
  savingsAllocationCents: number;
  flexibleSpendingCents: number;
  spentSoFarCents: number;
  remainingThisMonthCents: number;
  safeToSpendCents: number;
  weeklySafeToSpendCents: number;
  weeksRemainingInMonth: number;
}

export function getPreviousMonthKey(monthKey: string): string {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

/** Recurring bills due in a budget month (before that cycle's next income date). */
export function getFixedBillsCentsForMonth(
  recurringBills: RecurringBill[],
  monthKey: string,
  incomeCycle?: IncomeCycle | null,
): number {
  const monthStart = startOfMonth(parseISO(`${monthKey}-01`));
  const referenceDate = endOfMonth(monthStart);

  if (incomeCycle && isIncomeCycleConfigured(incomeCycle)) {
    const { startIso, endIso } = getCycleWindowForMonthKey(incomeCycle, monthKey);
    const bills = getUpcomingBills(recurringBills, endIso, startIso, referenceDate);
    return bills.reduce((sum, bill) => sum + bill.amountCents, 0);
  }

  const monthStartIso = `${monthKey}-01`;
  const nextIncomeDate = getDefaultNextIncomeDateForMonth(monthKey);
  const bills = getUpcomingBills(recurringBills, nextIncomeDate, monthStartIso, referenceDate);
  return bills.reduce((sum, bill) => sum + bill.amountCents, 0);
}

export function computeSavingsAllocationCents(savingsGoals: SavingsGoal[]): number {
  return savingsGoals.reduce(
    (sum, goal) => sum + calculateGoalPlan(goal).monthlyRequiredSavingCents,
    0,
  );
}

export interface ComputePreviousMonthLeftoverParams {
  previousMonthKey: string;
  budget: BudgetMonth | null;
  expenses: Expense[];
  recurringBills: RecurringBill[];
  savingsGoals: SavingsGoal[];
  userId?: string;
}

/**
 * Unallocated money at the end of the prior month:
 * income + carried-in − bills − savings − expenses − adjustments (leftover already applied).
 */
export function computePreviousMonthLeftoverCents({
  previousMonthKey,
  budget,
  expenses,
  recurringBills,
  savingsGoals,
  userId,
  incomeCycle,
}: ComputePreviousMonthLeftoverParams & { incomeCycle?: IncomeCycle | null }): number {
  const salaryCents = budget?.salaryCents ?? 0;
  if (salaryCents <= 0) return 0;

  const spentSoFarCents = expenses.reduce((sum, exp) => sum + exp.amountCents, 0);
  const fixedBillsCents = getFixedBillsCentsForMonth(recurringBills, previousMonthKey, incomeCycle);
  const savingsAllocationCents = computeSavingsAllocationCents(savingsGoals);
  const adjustments = userId
    ? getMonthAdjustments(userId, previousMonthKey)
    : {
        rolloverBoostCents: 0,
        weeklyReductionCents: 0,
        leftoverCoverCents: 0,
        pausedGoalIds: [],
        dailyPaceTargetCents: null,
      };

  const plan = buildMonthBudgetPlan({
    salaryCents,
    rolloverBoostCents: adjustments.rolloverBoostCents,
    fixedBillsCents,
    savingsAllocationCents,
    spentSoFarCents,
    fromDate: endOfMonth(parseISO(`${previousMonthKey}-01`)),
    incomeCycle,
  });

  const leftover = plan.safeToSpendCents - adjustments.leftoverCoverCents;
  return Math.max(0, leftover);
}

export function getWeeksRemainingInMonth(
  fromDate = new Date(),
  incomeCycle?: IncomeCycle | null,
): number {
  if (incomeCycle && isIncomeCycleConfigured(incomeCycle)) {
    return getWeeksRemainingInCycle(incomeCycle, fromDate);
  }
  const end = endOfMonth(fromDate);
  const daysLeft = Math.max(1, differenceInCalendarDays(end, fromDate) + 1);
  return Math.max(1, Math.ceil(daysLeft / 7));
}

export function computeWeeklySafeToSpend(
  safeToSpendCents: number,
  fromDate = new Date(),
  incomeCycle?: IncomeCycle | null,
): number {
  const weeks = getWeeksRemainingInMonth(fromDate, incomeCycle);
  if (safeToSpendCents <= 0) return 0;
  return Math.round(safeToSpendCents / weeks);
}

export function buildMonthBudgetPlan(params: {
  salaryCents: number;
  rolloverBoostCents?: number;
  fixedBillsCents: number;
  savingsAllocationCents: number;
  spentSoFarCents: number;
  fromDate?: Date;
  incomeCycle?: IncomeCycle | null;
}): MonthBudgetPlan {
  const {
    salaryCents,
    rolloverBoostCents = 0,
    fixedBillsCents,
    savingsAllocationCents,
    spentSoFarCents,
    fromDate = new Date(),
    incomeCycle = null,
  } = params;

  const effectiveIncomeCents = salaryCents + rolloverBoostCents;
  const flexibleSpendingCents = Math.max(
    0,
    effectiveIncomeCents - fixedBillsCents - savingsAllocationCents,
  );
  const alignedSafeToSpend = computeSafeToSpendCents({
    incomeForCurrentCycleCents: salaryCents,
    spentSoFarCents,
    upcomingBillsBeforeIncomeDateCents: fixedBillsCents,
    savingsGoalsForCurrentCycleCents: savingsAllocationCents,
    rolloverBoostCents,
  });
  const weeksRemainingInMonth = getWeeksRemainingInMonth(fromDate, incomeCycle);

  return {
    monthlyIncomeCents: salaryCents,
    rolloverBoostCents,
    effectiveIncomeCents,
    fixedBillsCents,
    savingsAllocationCents,
    flexibleSpendingCents,
    spentSoFarCents,
    remainingThisMonthCents: flexibleSpendingCents - spentSoFarCents,
    safeToSpendCents: alignedSafeToSpend,
    weeklySafeToSpendCents: computeWeeklySafeToSpend(
      Math.max(0, alignedSafeToSpend),
      fromDate,
      incomeCycle,
    ),
    weeksRemainingInMonth,
  };
}

/** @deprecated Use getNextIncomeDateIso with the user's income cycle. */
export function getNextSalaryDateForMonth(monthKey: string, incomeCycle?: IncomeCycle | null): string {
  if (incomeCycle && isIncomeCycleConfigured(incomeCycle)) {
    return getNextIncomeDateIso(incomeCycle, endOfMonth(parseISO(`${monthKey}-01`)));
  }
  return getDefaultNextIncomeDateForMonth(monthKey);
}
