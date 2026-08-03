import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type { Expense, RecurringBill } from "@/types/finance";
import type { IncomeCycle } from "@/types/incomeCycle";
import { formatMoney } from "@/utils/money";
import {
  getDaysElapsedInCycle,
  getDaysRemainingInCycle,
  getDefaultNextIncomeDateForMonth,
  getNextIncomeDate,
  isIncomeCycleConfigured,
} from "@/utils/incomeCycle";
import { getDaysUntil } from "@/utils/recurringBills";
import {
  computeRecommendedDailyPaceCents,
  shouldMayRunShortBeforePayday,
} from "@/utils/paceSupport";

export type PaceEmotionalTone = "calm" | "supportive" | "tight";

export interface PaceTransparencyLine {
  label: string;
  amountCents: number;
  kind: "bill" | "pace" | "projection" | "balance";
}

export interface PaceSuggestedAction {
  id: "move_from_savings" | "pause_goal" | "reduce_daily_pace" | "review_bills";
  label: string;
  hint: string;
  to: string;
}

export interface FinancialPaceInput {
  salaryCents: number;
  totalSpentCents: number;
  leftUntilPaydayCents: number;
  upcomingBills: RecurringBill[];
  upcomingBillsCents: number;
  savingsAllocationCents: number;
  expenses: Expense[];
  currentMonth: string;
  hasSavingsGoals: boolean;
  currency?: string;
  today?: Date;
  dailyPaceTargetCents?: number | null;
  incomeCycle?: IncomeCycle | null;
}

export interface FinancialPace {
  leftUntilPaydayCents: number;
  currentBalanceCents: number;
  /** Income minus upcoming bills (before goals and discretionary spend). */
  availableAfterBillsCents: number;
  /** Income minus bills and savings goal allocation (before discretionary spend). */
  availableAfterBillsAndGoalsCents: number;
  /** Left in cycle divided by days until income date — use for home daily pace chip. */
  cycleDailyPaceCents: number;
  daysUntilPayday: number;
  typicalDailySpendCents: number;
  /** Display pace — user target when set, otherwise typical. */
  effectiveDailySpendCents: number;
  dailyPaceTargetCents: number | null;
  actualDailySpendCents: number;
  projectedBalanceBeforeSalaryCents: number;
  mayRunShort: boolean;
  daysUntilShort: number | null;
  emotionalTone: PaceEmotionalTone;
  heroSubline: string;
  transparencyLines: PaceTransparencyLine[];
  guidanceHeadline: string | null;
  guidanceDetail: string | null;
  suggestedActions: PaceSuggestedAction[];
}

function sumExpensesSince(expenses: Expense[], since: Date, until: Date): number {
  const startIso = format(since, "yyyy-MM-dd");
  const endIso = format(until, "yyyy-MM-dd");
  return expenses
    .filter((expense) => {
      const dateIso = expense.date.slice(0, 10);
      return dateIso >= startIso && dateIso <= endIso;
    })
    .reduce((sum, expense) => sum + expense.amountCents, 0);
}

/** Typical daily discretionary spend from the last 28 completed days. */
export function computeTypicalDailySpendCents(
  expenses: Expense[],
  today = new Date(),
): number {
  const end = startOfDay(today);
  const start = addDays(end, -28);
  const total = sumExpensesSince(expenses, start, end);
  if (total <= 0) return 0;
  return Math.round(total / 28);
}

function computeDaysUntilShort(params: {
  startBalanceCents: number;
  upcomingBills: RecurringBill[];
  dailySpendCents: number;
  daysUntilPayday: number;
  today: Date;
}): number | null {
  const { startBalanceCents, upcomingBills, dailySpendCents, daysUntilPayday, today } = params;
  if (daysUntilPayday <= 0) return null;

  let balance = startBalanceCents;
  const billsByDay = new Map<number, number>();
  for (const bill of upcomingBills) {
    const days = getDaysUntil(bill.nextDueDate, today);
    if (days < 0 || days > daysUntilPayday) continue;
    billsByDay.set(days, (billsByDay.get(days) ?? 0) + bill.amountCents);
  }

  for (let day = 0; day <= daysUntilPayday; day += 1) {
    balance -= billsByDay.get(day) ?? 0;
    if (day < daysUntilPayday) {
      balance -= dailySpendCents;
    }
    if (balance < 0) return day === 0 ? 0 : day;
  }

  return null;
}

export function buildFinancialPace(input: FinancialPaceInput): FinancialPace {
  const {
    salaryCents,
    totalSpentCents,
    leftUntilPaydayCents,
    upcomingBills,
    upcomingBillsCents,
    savingsAllocationCents,
    expenses,
    currentMonth,
    hasSavingsGoals,
    currency = "EUR",
    today = new Date(),
    dailyPaceTargetCents: inputDailyPaceTarget = null,
    incomeCycle = null,
  } = input;

  const actualToday = startOfDay(today);
  const cycleConfigured = isIncomeCycleConfigured(incomeCycle);
  const nextIncomeDate = cycleConfigured
    ? getNextIncomeDate(incomeCycle, actualToday)
    : parseISO(getDefaultNextIncomeDateForMonth(currentMonth));
  const daysUntilPayday = cycleConfigured
    ? getDaysRemainingInCycle(incomeCycle, actualToday)
    : Math.max(0, differenceInCalendarDays(nextIncomeDate, actualToday));

  const currentBalanceCents = Math.max(0, salaryCents - totalSpentCents);
  const availableAfterBillsCents = salaryCents - upcomingBillsCents;
  const availableAfterBillsAndGoalsCents =
    salaryCents - upcomingBillsCents - savingsAllocationCents;

  const daysElapsed = cycleConfigured
    ? getDaysElapsedInCycle(incomeCycle, actualToday)
    : Math.max(
        1,
        differenceInCalendarDays(actualToday, startOfMonth(parseISO(`${currentMonth}-01`))) + 1,
      );
  const actualDailySpendCents =
    totalSpentCents > 0 ? Math.round(totalSpentCents / daysElapsed) : 0;

  const cycleDailyPaceCents =
    daysUntilPayday > 0
      ? Math.max(0, Math.floor(leftUntilPaydayCents / daysUntilPayday))
      : 0;

  const typicalDailySpendCents = computeTypicalDailySpendCents(expenses, actualToday);
  const paceForProjection =
    typicalDailySpendCents > 0
      ? Math.max(typicalDailySpendCents, actualDailySpendCents)
      : actualDailySpendCents;

  const projectedDiscretionarySpend = paceForProjection * daysUntilPayday;
  const projectedBalanceBeforeSalaryCents =
    leftUntilPaydayCents - projectedDiscretionarySpend;

  const daysUntilShort = computeDaysUntilShort({
    startBalanceCents: leftUntilPaydayCents,
    upcomingBills,
    dailySpendCents: paceForProjection,
    daysUntilPayday,
    today: actualToday,
  });

  const mayRunShort =
    leftUntilPaydayCents < 0 ||
    shouldMayRunShortBeforePayday({
      leftUntilPaydayCents,
      dailyPaceCents: paceForProjection,
      daysToSalary: daysUntilPayday,
      upcomingBillsBeforeSalaryCents: upcomingBillsCents,
    });

  const effectiveDailySpendCents =
    inputDailyPaceTarget != null && inputDailyPaceTarget > 0
      ? inputDailyPaceTarget
      : cycleConfigured && leftUntilPaydayCents > 0
        ? cycleDailyPaceCents || paceForProjection
        : paceForProjection;

  const tightThreshold = Math.max(
    paceForProjection * 3,
    Math.round((salaryCents || 0) * 0.05),
  );
  const emotionalTone: PaceEmotionalTone = mayRunShort
    ? "tight"
    : leftUntilPaydayCents <= tightThreshold && upcomingBillsCents > 0
      ? "supportive"
      : "calm";

  const leftLabel = formatMoney(Math.max(0, leftUntilPaydayCents), currency);
  const heroSubline =
    leftUntilPaydayCents < 0
      ? "to reconcile this cycle"
      : "left in this cycle";

  const transparencyLines: PaceTransparencyLine[] = [];

  if (currentBalanceCents > 0) {
    transparencyLines.push({
      label: "Current balance",
      amountCents: currentBalanceCents,
      kind: "balance",
    });
  }

  for (const bill of upcomingBills.slice(0, 4)) {
    transparencyLines.push({
      label: bill.name,
      amountCents: bill.amountCents,
      kind: "bill",
    });
  }

  if (upcomingBills.length > 4) {
    const rest = upcomingBills.slice(4).reduce((sum, bill) => sum + bill.amountCents, 0);
    transparencyLines.push({
      label: `${upcomingBills.length - 4} more bills`,
      amountCents: rest,
      kind: "bill",
    });
  }

  if (paceForProjection > 0) {
    transparencyLines.push({
      label: "Typical pace",
      amountCents: paceForProjection,
      kind: "pace",
    });
  }

  transparencyLines.push({
    label: "Projected balance before income date",
    amountCents: projectedBalanceBeforeSalaryCents,
    kind: "projection",
  });

  let guidanceHeadline: string | null = null;
  let guidanceDetail: string | null = null;

  if (mayRunShort) {
    guidanceHeadline = "You may need support before your income date.";
    if (daysUntilShort != null && daysUntilShort > 0) {
      guidanceDetail = `Based on your current pace and upcoming bills, you may run short in ${daysUntilShort} day${daysUntilShort === 1 ? "" : "s"}.`;
    } else if (leftUntilPaydayCents < 0) {
      guidanceDetail =
        "Your bills and pace are ahead of what's left this cycle — a small adjustment can help you feel steadier.";
    } else {
      guidanceDetail =
        "Based on your current pace and upcoming bills, everyday spending may need a gentler rhythm before your income date.";
    }
  } else if (emotionalTone === "supportive") {
    guidanceHeadline = "A thoughtful week ahead.";
    guidanceDetail = `${formatMoney(upcomingBillsCents, currency)} in bills is still due — pacing calmly will help ${leftLabel} last until your income date.`;
  }

  const suggestedActions: PaceSuggestedAction[] = [];
  const gentleDailyCents = computeRecommendedDailyPaceCents(
    leftUntilPaydayCents,
    daysUntilPayday,
  );

  if (mayRunShort) {
    suggestedActions.push(
      {
        id: "move_from_savings",
        label: "Move money from savings",
        hint: "Use what you have set aside — only if it feels right.",
        to: "/goals",
      },
      {
        id: "pause_goal",
        label: "Pause a goal temporarily",
        hint: "Free up room this month without giving up the goal.",
        to: "/goals",
      },
      {
        id: "reduce_daily_pace",
        label: "Reduce daily pace",
        hint: `Aim closer to ${formatMoney(gentleDailyCents, currency)} per day until your income date.`,
        to: "/cycle",
      },
    );
  } else if (emotionalTone === "supportive") {
    if (hasSavingsGoals) {
      suggestedActions.push({
        id: "move_from_savings",
        label: "Move money from savings",
        hint: "Use what you have set aside — only if it feels right.",
        to: "/goals",
      });
    }
    suggestedActions.push({
      id: "reduce_daily_pace",
      label: "Reduce daily pace",
      hint: `Aim closer to ${formatMoney(gentleDailyCents, currency)} per day until your income date.`,
      to: "/cycle",
    });
    if (upcomingBills.length > 0) {
      suggestedActions.push({
        id: "review_bills",
        label: "Review upcoming bills",
        hint: "See what's due and when — no surprises.",
        to: "/bills",
      });
    }
  }

  return {
    leftUntilPaydayCents,
    currentBalanceCents,
    availableAfterBillsCents,
    availableAfterBillsAndGoalsCents,
    cycleDailyPaceCents,
    daysUntilPayday,
    typicalDailySpendCents: paceForProjection,
    effectiveDailySpendCents,
    dailyPaceTargetCents: inputDailyPaceTarget,
    actualDailySpendCents,
    projectedBalanceBeforeSalaryCents,
    mayRunShort,
    daysUntilShort,
    emotionalTone,
    heroSubline,
    transparencyLines,
    guidanceHeadline,
    guidanceDetail,
    suggestedActions,
  };
}
