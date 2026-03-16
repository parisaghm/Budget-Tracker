import { differenceInMonths, parseISO, startOfMonth } from 'date-fns';
import type { SavingsGoal } from '@/types/finance';

export interface GoalPlan {
  monthsRemaining: number;
  remainingAmountCents: number;
  monthlyRequiredSavingCents: number;
}

/**
 * Compute derived goal values: months left until target, remaining amount, and required monthly saving.
 * Reactive to savedCents changes (remaining and monthly requirement update).
 */
export function calculateGoalPlan(goal: SavingsGoal): GoalPlan {
  const remainingAmountCents = Math.max(0, goal.targetCents - goal.savedCents);
  const target = startOfMonth(parseISO(goal.targetDate));
  const today = startOfMonth(new Date());
  const monthsRemaining = Math.max(0, differenceInMonths(target, today));

  const monthlyRequiredSavingCents =
    monthsRemaining > 0 ? Math.ceil(remainingAmountCents / monthsRemaining) : 0;

  return {
    monthsRemaining,
    remainingAmountCents,
    monthlyRequiredSavingCents,
  };
}
