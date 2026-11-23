import type { BudgetCycle } from "@/types/budgetCycle";
import {
  EXPENSE_DATE_OUTSIDE_CYCLES_MESSAGE,
  resolveExpenseCycleMonth,
  validateExpenseForm,
  type ExpenseFormInput,
} from "@/utils/expenseFormValidation";

function cycle(startDate: string, endDate: string): BudgetCycle {
  return {
    id: `${startDate}_${endDate}`,
    userId: "u",
    startDate,
    endDate,
    status: "closed",
    scheduleType: "monthly_15",
    createdAt: "2026-01-01T00:00:00Z",
  };
}

/** Dev/acceptance checks for the Expenses inline form Save gating and month resolution. */
export function runExpenseFormValidationCheck(): { pass: boolean; details: string[] } {
  const details: string[] = [];
  let pass = true;
  const expect = (label: string, actual: unknown, expected: unknown) => {
    if (actual === expected) {
      details.push(`ok: ${label}`);
    } else {
      pass = false;
      details.push(`FAIL: ${label} — expected ${String(expected)}, got ${String(actual)}`);
    }
  };

  const oct = cycle("2026-10-15", "2026-11-15");
  const nov = cycle("2026-11-15", "2026-12-15");
  const cycles = [oct, nov];
  const base: ExpenseFormInput = {
    mode: "adding",
    note: "Rent",
    amount: "1200",
    category: "housing",
    date: "2026-11-20",
    knownCategories: new Set(["housing", "groceries"]),
    cycles,
    currencySymbol: "€",
  };
  const isValid = (input: ExpenseFormInput) =>
    Object.keys(validateExpenseForm(input).errors).length === 0;

  // Missing category blocks Save and explains why.
  const noCategory = validateExpenseForm({ ...base, category: "" });
  expect("no category → invalid", isValid({ ...base, category: "" }), false);
  expect("no category → reason", noCategory.blockingReason, "Choose a category to save");
  expect("no category → field error", noCategory.errors.category, "Choose a category.");

  // Valid note + amount + category + date inside Nov15–Dec15 enables Save.
  expect("valid input → valid", isValid(base), true);
  expect("valid input → no reason", validateExpenseForm(base).blockingReason, null);
  expect("Dec 14 (last day of Nov cycle) → valid", isValid({ ...base, date: "2026-12-14" }), true);

  // Invalid amount is reported.
  for (const amount of ["", "0", "abc", "-5", "1.234"]) {
    const r = validateExpenseForm({ ...base, amount });
    expect(`amount "${amount}" → reason`, r.blockingReason, "Enter an amount greater than €0.00 to save");
  }
  expect("amount with comma → valid", isValid({ ...base, amount: "12,50" }), true);

  // Date outside all frozen cycles is rejected with a visible reason.
  const outside = validateExpenseForm({ ...base, date: "2026-12-20" });
  expect("date outside cycles → date error", outside.errors.date, EXPENSE_DATE_OUTSIDE_CYCLES_MESSAGE);
  expect("date outside cycles → reason", outside.blockingReason, EXPENSE_DATE_OUTSIDE_CYCLES_MESSAGE);

  // Malformed Nov15–Dec1 row: Dec 5 is not silently accepted.
  const malformed = [oct, cycle("2026-11-15", "2026-12-01")];
  expect(
    "malformed cycle data → Dec 5 rejected",
    validateExpenseForm({ ...base, cycles: malformed, date: "2026-12-05" }).errors.date,
    EXPENSE_DATE_OUTSIDE_CYCLES_MESSAGE,
  );

  // No cycles loaded (demo) skips the cycle check but still validates fields.
  expect("no cycles → date check skipped", isValid({ ...base, cycles: null, date: "2030-01-01" }), true);

  // First missing field wins the reason.
  expect(
    "empty form → note reason first",
    validateExpenseForm({ ...base, note: "", amount: "", category: "" }).blockingReason,
    "Enter where you spent the money to save",
  );
  expect("editing allows empty note", isValid({ ...base, mode: "editing", note: "" }), true);

  // Month comes from the containing frozen cycle, not the viewed month.
  expect("Nov 20 → month 2026-11", resolveExpenseCycleMonth("2026-11-20", cycles)?.month, "2026-11");
  expect("Nov 10 → Oct cycle month 2026-10", resolveExpenseCycleMonth("2026-11-10", cycles)?.month, "2026-10");
  expect("Nov 10 → Oct cycle id", resolveExpenseCycleMonth("2026-11-10", cycles)?.cycle.id, oct.id);
  expect("Dec 15 → no cycle", resolveExpenseCycleMonth("2026-12-15", cycles), null);
  expect("invalid date → no cycle", resolveExpenseCycleMonth("not-a-date", cycles), null);

  return { pass, details };
}

if (import.meta.env?.DEV) {
  (globalThis as unknown as { __runExpenseFormValidationCheck?: typeof runExpenseFormValidationCheck })
    .__runExpenseFormValidationCheck = runExpenseFormValidationCheck;
}
