import { useMemo } from "react";
import type { MonthData, RecurringBill, SavingsGoal } from "@/types/finance";
import type { IncomeCycle } from "@/types/incomeCycle";
import { computePreviousMonthLeftoverCents, getPreviousMonthKey } from "@/utils/budgetPlanner";

export function usePreviousMonthLeftover(params: {
  currentMonth: string;
  getMonthData: (month: string) => MonthData;
  recurringBills: RecurringBill[];
  savingsGoals: SavingsGoal[];
  userId?: string;
  incomeCycle?: IncomeCycle | null;
}) {
  const { currentMonth, getMonthData, recurringBills, savingsGoals, userId, incomeCycle } = params;
  const previousMonthKey = getPreviousMonthKey(currentMonth);
  const previousMonthData = useMemo(
    () => getMonthData(previousMonthKey),
    [getMonthData, previousMonthKey],
  );
  const previousLeftoverCents = useMemo(
    () =>
      computePreviousMonthLeftoverCents({
        previousMonthKey,
        budget: previousMonthData.budget,
        expenses: previousMonthData.expenses,
        recurringBills,
        savingsGoals,
        userId,
        incomeCycle,
      }),
    [previousMonthData, previousMonthKey, recurringBills, savingsGoals, userId, incomeCycle],
  );

  return { previousMonthKey, previousLeftoverCents };
}
