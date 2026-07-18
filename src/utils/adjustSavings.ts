import type { MovableGoalSource } from "@/utils/paceSupport";

export const SAVINGS_BUFFER_OPTIONS_CENTS = [0, 5000, 10000] as const;

export function computeActiveSavingsContributionCents(params: {
  savingsAllocationCents: number;
  pausedGoalsBoostCents: number;
  goalReallocationBoostCents: number;
}): number {
  const { savingsAllocationCents, pausedGoalsBoostCents, goalReallocationBoostCents } = params;
  return Math.max(0, savingsAllocationCents - pausedGoalsBoostCents - goalReallocationBoostCents);
}

export function computeDeficitCents(safeToSpendCents: number): number {
  return safeToSpendCents < 0 ? Math.abs(safeToSpendCents) : 0;
}

export function projectAfterSavingsReduction(params: {
  safeToSpendCents: number;
  activeSavingsContributionCents: number;
  reductionCents: number;
}): {
  newSavingsContributionCents: number;
  newSafeToSpendCents: number;
} {
  const { safeToSpendCents, activeSavingsContributionCents, reductionCents } = params;
  const appliedReduction = Math.min(
    Math.max(0, reductionCents),
    activeSavingsContributionCents,
  );
  return {
    newSavingsContributionCents: activeSavingsContributionCents - appliedReduction,
    newSafeToSpendCents: safeToSpendCents + appliedReduction,
  };
}

/** Spread a cycle savings reduction across goals with remaining allocation. */
export function distributeSavingsReductionAcrossGoals(
  reductionCents: number,
  sources: MovableGoalSource[],
): Record<string, number> {
  if (reductionCents <= 0 || sources.length === 0) return {};

  const eligible = sources.filter((source) => source.availableCents > 0);
  const totalAvailable = eligible.reduce((sum, source) => sum + source.availableCents, 0);
  if (totalAvailable <= 0) return {};

  const cappedReduction = Math.min(reductionCents, totalAvailable);
  const allocations: Record<string, number> = {};
  let assigned = 0;

  eligible.forEach((source, index) => {
    const isLast = index === eligible.length - 1;
    const share = isLast
      ? cappedReduction - assigned
      : Math.floor((cappedReduction * source.availableCents) / totalAvailable);
    const amount = Math.min(share, source.availableCents);
    if (amount > 0) {
      allocations[source.goal.id] = amount;
      assigned += amount;
    }
  });

  return allocations;
}

export function sumGoalAllocations(allocations: Record<string, number>): number {
  return Object.values(allocations).reduce((sum, cents) => sum + cents, 0);
}
