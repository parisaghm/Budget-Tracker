import type { SavingsGoal } from "@/types/finance";
import { calculateGoalPlan } from "@/utils/goalPlan";

export interface MovableGoalSource {
  goal: SavingsGoal;
  monthlyAllocationCents: number;
  alreadyReallocatedCents: number;
  availableCents: number;
}

/** €50 — show support when left in this cycle is below this. */
export const PAYDAY_LOW_BALANCE_THRESHOLD_CENTS = 5000;

export function shouldMayRunShortBeforePayday(params: {
  leftUntilPaydayCents: number;
  dailyPaceCents: number;
  daysToSalary: number;
  upcomingBillsBeforeSalaryCents: number;
}): boolean {
  const {
    leftUntilPaydayCents,
    dailyPaceCents,
    daysToSalary,
    upcomingBillsBeforeSalaryCents,
  } = params;

  if (leftUntilPaydayCents < PAYDAY_LOW_BALANCE_THRESHOLD_CENTS) return true;
  if (upcomingBillsBeforeSalaryCents > leftUntilPaydayCents) return true;
  if (
    daysToSalary > 0 &&
    dailyPaceCents > 0 &&
    leftUntilPaydayCents < dailyPaceCents * daysToSalary
  ) {
    return true;
  }
  return false;
}

export function getPausedGoalsAllocationCents(
  goals: SavingsGoal[],
  pausedGoalIds: string[],
): number {
  if (pausedGoalIds.length === 0) return 0;
  const paused = new Set(pausedGoalIds);
  return goals
    .filter((goal) => paused.has(goal.id))
    .reduce((sum, goal) => sum + calculateGoalPlan(goal).monthlyRequiredSavingCents, 0);
}

export function computeRecommendedDailyPaceCents(
  leftUntilPaydayCents: number,
  daysToSalary: number,
): number {
  if (daysToSalary <= 0) return 0;
  return Math.max(0, Math.floor(leftUntilPaydayCents / daysToSalary));
}

export function getGoalReallocationBoostCents(
  goalReallocationCents: Record<string, number>,
): number {
  return Object.values(goalReallocationCents).reduce((sum, cents) => sum + cents, 0);
}

/** Goals with remaining monthly allocation that can be moved back into spending. */
export function getMovableGoalSources(
  goals: SavingsGoal[],
  pausedGoalIds: string[],
  goalReallocationCents: Record<string, number>,
): MovableGoalSource[] {
  const paused = new Set(pausedGoalIds);
  return goals
    .filter((goal) => !paused.has(goal.id))
    .map((goal) => {
      const monthlyAllocationCents = calculateGoalPlan(goal).monthlyRequiredSavingCents;
      const alreadyReallocatedCents = goalReallocationCents[goal.id] ?? 0;
      const availableCents = Math.max(0, monthlyAllocationCents - alreadyReallocatedCents);
      return { goal, monthlyAllocationCents, alreadyReallocatedCents, availableCents };
    })
    .filter((source) => source.availableCents > 0);
}
