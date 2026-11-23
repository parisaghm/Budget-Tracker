import type { BudgetCycle } from "@/types/budgetCycle";
import {
  budgetMonthKeyFromCycle,
  findCycleContainingDate,
  isDateInCycleRange,
} from "@/utils/budgetCycles";
import { eurosToCents, toDateInputValue } from "@/utils/money";

export type ExpenseFormFieldErrors = {
  note?: string;
  amount?: string;
  category?: string;
  date?: string;
};

export const EXPENSE_DATE_OUTSIDE_CYCLES_MESSAGE = "No budget cycle covers this date.";

export function parseExpenseAmountInput(raw: string): { ok: true; cents: number } | { ok: false } {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return { ok: false };
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return { ok: false };
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value) || value <= 0) return { ok: false };
  const cents = eurosToCents(value);
  if (cents <= 0) return { ok: false };
  return { ok: true, cents };
}

/**
 * Frozen cycle containing the transaction date and the budget month derived
 * from that cycle's start. Null when no frozen cycle covers the date — callers
 * must refuse the save rather than clamp the date or invent a cycle.
 */
export function resolveExpenseCycleMonth(
  dateYmd: string,
  cycles: BudgetCycle[],
): { cycle: BudgetCycle; month: string } | null {
  const date = toDateInputValue(dateYmd);
  if (!date) return null;
  const cycle = findCycleContainingDate(cycles, date);
  if (!cycle) return null;
  return { cycle, month: budgetMonthKeyFromCycle(cycle) };
}

export interface ExpenseFormInput {
  mode: "adding" | "editing";
  note: string;
  amount: string;
  category: string;
  date: string;
  knownCategories: Set<string>;
  /**
   * Frozen cycles used to check the date. Null/empty skips the check
   * (demo mode or cycles not loaded yet).
   */
  cycles: Pick<BudgetCycle, "startDate" | "endDate">[] | null;
  currencySymbol: string;
}

/**
 * Field errors plus a single short reason explaining why Save is disabled,
 * so the button is never inactive without an explanation.
 */
export function validateExpenseForm(input: ExpenseFormInput): {
  errors: ExpenseFormFieldErrors;
  blockingReason: string | null;
} {
  const errors: ExpenseFormFieldErrors = {};
  let blockingReason: string | null = null;
  const block = (reason: string) => {
    if (!blockingReason) blockingReason = reason;
  };

  // Allow empty note when editing so existing "Untitled expense" rows remain editable.
  if (input.mode === "adding" && !input.note.trim()) {
    errors.note = "Enter where you spent the money.";
    block("Enter where you spent the money to save");
  }

  if (!parseExpenseAmountInput(input.amount).ok) {
    errors.amount = `Enter an amount greater than ${input.currencySymbol}0.00.`;
    block(`Enter an amount greater than ${input.currencySymbol}0.00 to save`);
  }

  if (!input.category || !input.knownCategories.has(input.category)) {
    errors.category = "Choose a category.";
    block("Choose a category to save");
  }

  const date = toDateInputValue(input.date);
  if (!date) {
    errors.date = "Choose a date.";
    block("Choose a date to save");
  } else if (
    input.cycles &&
    input.cycles.length > 0 &&
    !input.cycles.some((c) => isDateInCycleRange(date, c.startDate, c.endDate))
  ) {
    errors.date = EXPENSE_DATE_OUTSIDE_CYCLES_MESSAGE;
    block(EXPENSE_DATE_OUTSIDE_CYCLES_MESSAGE);
  }

  return { errors, blockingReason };
}
