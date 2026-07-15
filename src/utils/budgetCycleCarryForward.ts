import type { BudgetMonth } from "@/types/finance";
import { getPreviousMonth } from "@/utils/money";

/** Walk back through prior budget months until one with salary is found. */
export function findPriorBudgetWithIncome(
  budgets: Record<string, BudgetMonth>,
  monthKey: string,
  maxSteps = 6,
): BudgetMonth | null {
  let cursor = getPreviousMonth(monthKey);
  for (let step = 0; step < maxSteps; step += 1) {
    const budget = budgets[cursor];
    if ((budget?.salaryCents ?? 0) > 0) {
      return budget;
    }
    cursor = getPreviousMonth(cursor);
  }
  return null;
}

/**
 * When a new income cycle month has no salary yet, inherit the most recent prior
 * cycle's income for display and planning so rollover does not look like data loss.
 */
export function buildInheritedBudgetForMonth(
  budgets: Record<string, BudgetMonth>,
  monthKey: string,
): BudgetMonth | null {
  const existing = budgets[monthKey] ?? null;
  if ((existing?.salaryCents ?? 0) > 0) {
    return existing;
  }

  const prior = findPriorBudgetWithIncome(budgets, monthKey);
  if (!prior) {
    return existing;
  }

  return {
    ...prior,
    id: existing?.id ?? prior.id,
    month: monthKey,
    salaryCents: prior.salaryCents,
    currency: prior.currency ?? existing?.currency ?? "EUR",
    incomeNote: prior.incomeNote ?? existing?.incomeNote,
    createdAt: existing?.createdAt ?? prior.createdAt,
  };
}
