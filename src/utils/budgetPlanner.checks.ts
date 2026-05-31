import { addMonths, format, startOfMonth } from "date-fns";
import {
  buildMonthBudgetPlan,
  computePreviousMonthLeftoverCents,
} from "@/utils/budgetPlanner";

/**
 * Acceptance scenario from product spec — run in dev tools if needed.
 * Monthly income €4100, savings €1400, spent €2200 → safe-to-spend €500.
 */
export function runBudgetAcceptanceCheck(): { pass: boolean; safeToSpendCents: number } {
  const plan = buildMonthBudgetPlan({
    salaryCents: 410_000,
    rolloverBoostCents: 0,
    fixedBillsCents: 0,
    savingsAllocationCents: 140_000,
    spentSoFarCents: 220_000,
  });
  const expected = 50_000;
  return {
    pass: plan.safeToSpendCents === expected && plan.monthlyIncomeCents === 410_000,
    safeToSpendCents: plan.safeToSpendCents,
  };
}

/**
 * April: income €4100, bills €1200, savings €1400, expenses €1000 → leftover €500.
 * Viewing May should surface €500 as last month's leftover.
 */
export function runAprilLeftoverAcceptanceCheck(): { pass: boolean; leftoverCents: number } {
  const leftoverCents = computePreviousMonthLeftoverCents({
    previousMonthKey: "2026-04",
    budget: {
      id: "test-april",
      month: "2026-04",
      salaryCents: 410_000,
      currency: "EUR",
      createdAt: new Date().toISOString(),
    },
    expenses: [{ id: "e1", budgetMonthId: "test-april", month: "2026-04", amountCents: 100_000, category: "other", date: "2026-04-15", note: "", createdAt: new Date().toISOString() }],
    recurringBills: [
      {
        id: "b1",
        userId: "test",
        name: "Rent",
        amountCents: 120_000,
        category: "rent",
        dueDay: 1,
        frequency: "monthly",
        status: "upcoming",
        nextDueDate: "2026-04-01",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    savingsGoals: [
      {
        id: "g1",
        name: "Fund",
        targetCents: 1_400_000,
        savedCents: 0,
        startDate: "2026-01-01",
        targetDate: format(addMonths(startOfMonth(new Date()), 1), "yyyy-MM-dd"),
        createdAt: new Date().toISOString(),
      },
    ],
  });
  const expected = 50_000;
  return { pass: leftoverCents === expected, leftoverCents };
}
