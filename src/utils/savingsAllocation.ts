import type { SavingsGoal } from "@/types/finance";
import { calculateGoalPlan } from "@/utils/goalPlan";
import { computeActiveSavingsContributionCents } from "@/utils/adjustSavings";
import { ONBOARDING_MONTHLY_SAVINGS_GOAL_NAME } from "@/utils/onboarding";

/** Onboarding stores the cycle plan as targetCents = monthlyCents * this horizon. */
export const SAVINGS_PLAN_HORIZON_MONTHS = 12;

export interface CycleContributionRow {
  id: string;
  goal_id: string;
  amount_cents: number;
  cycle_id: string | null;
  created_at: string;
}

export interface CycleAllocationValidation {
  valid: boolean;
  totalCents: number;
  remainingCents: number;
  error?: string;
}

export type AuthoritativeSavingsPlan =
  | {
      hasPlan: true;
      /** Gross cycle reservation before pause/reallocation (integer cents). */
      plannedGrossCents: number;
      planGoal: SavingsGoal;
    }
  | {
      hasPlan: false;
      plannedGrossCents: 0;
      planGoal: null;
    };

/** Goals that can receive cycle allocations (excludes onboarding meta plan). */
export function allocationGoals(goals: SavingsGoal[]): SavingsGoal[] {
  return goals.filter((g) => g.name !== ONBOARDING_MONTHLY_SAVINGS_GOAL_NAME);
}

export function findMonthlySavingsPlanGoal(
  goals: SavingsGoal[],
): SavingsGoal | undefined {
  return goals.find((g) => g.name === ONBOARDING_MONTHLY_SAVINGS_GOAL_NAME);
}

/**
 * Fixed cycle plan amount from the meta goal.
 * Onboarding persists monthlyCents * 12 as target_cents — do not use per-goal
 * recommended-saving math (that is display-only for Buy Car / Travel).
 */
export function monthlyPlanCentsFromMetaGoal(planGoal: SavingsGoal): number {
  return Math.max(0, Math.round(planGoal.targetCents / SAVINGS_PLAN_HORIZON_MONTHS));
}

/**
 * Resolve the authoritative cycle savings plan.
 * Never sums allocation-target recommendations. Missing meta goal → no plan.
 */
export function resolveAuthoritativeSavingsPlan(
  goals: SavingsGoal[],
): AuthoritativeSavingsPlan {
  const planGoal = findMonthlySavingsPlanGoal(goals);
  if (!planGoal || planGoal.targetCents <= 0) {
    return { hasPlan: false, plannedGrossCents: 0, planGoal: null };
  }
  const plannedGrossCents = monthlyPlanCentsFromMetaGoal(planGoal);
  if (plannedGrossCents <= 0) {
    return { hasPlan: false, plannedGrossCents: 0, planGoal: null };
  }
  return { hasPlan: true, plannedGrossCents, planGoal };
}

/**
 * Gross cycle savings reservation before pause/reallocation.
 * @deprecated Prefer resolveAuthoritativeSavingsPlan — kept as a thin wrapper.
 */
export function computeGrossSavingsAllocationCents(params: {
  goals: SavingsGoal[];
  allocatedThisCycleByGoal?: Record<string, number>;
}): number {
  return resolveAuthoritativeSavingsPlan(params.goals).plannedGrossCents;
}

/** Pause boost only when the meta plan goal itself is paused. */
export function computePlanPausedBoostCents(params: {
  goals: SavingsGoal[];
  pausedGoalIds: string[];
  allocatedThisCycleByGoal?: Record<string, number>;
}): number {
  const { goals, pausedGoalIds } = params;
  if (pausedGoalIds.length === 0) return 0;
  const plan = resolveAuthoritativeSavingsPlan(goals);
  if (!plan.hasPlan || !plan.planGoal) return 0;
  return pausedGoalIds.includes(plan.planGoal.id) ? plan.plannedGrossCents : 0;
}

/** Reallocation boost only for the meta plan goal. */
export function computePlanReallocationBoostCents(params: {
  goals: SavingsGoal[];
  goalReallocationCents: Record<string, number>;
}): number {
  const { goals, goalReallocationCents } = params;
  const plan = resolveAuthoritativeSavingsPlan(goals);
  if (!plan.hasPlan || !plan.planGoal) return 0;
  return Math.max(0, Math.round(goalReallocationCents[plan.planGoal.id] ?? 0));
}

export function computeAllocatedThisCycleCents(
  contributionsByGoal: Record<string, number>,
): number {
  return Object.values(contributionsByGoal).reduce(
    (sum, cents) => sum + Math.max(0, Math.round(cents) || 0),
    0,
  );
}

export function computeAvailableToAllocateCents(
  plannedSavingsCents: number,
  allocatedThisCycleCents: number,
): number {
  return Math.max(0, Math.round(plannedSavingsCents) - Math.round(allocatedThisCycleCents));
}

/**
 * Active planned / reserved savings for Safe to Spend and allocation ceiling.
 * Returns 0 when no authoritative plan exists (does not invent a sum of goals).
 */
export function computeSavingsReservationCents(params: {
  goals: SavingsGoal[];
  allocatedThisCycleByGoal?: Record<string, number>;
  pausedGoalsBoostCents: number;
  goalReallocationBoostCents: number;
}): number {
  const { goals, pausedGoalsBoostCents, goalReallocationBoostCents } = params;
  const plan = resolveAuthoritativeSavingsPlan(goals);
  if (!plan.hasPlan) return 0;

  return computeActiveSavingsContributionCents({
    savingsAllocationCents: plan.plannedGrossCents,
    pausedGoalsBoostCents,
    goalReallocationBoostCents,
  });
}

export function computePlannedSavingsCents(params: {
  goals: SavingsGoal[];
  allocatedThisCycleByGoal?: Record<string, number>;
  pausedGoalsBoostCents: number;
  goalReallocationBoostCents: number;
}): number {
  return computeSavingsReservationCents(params);
}

export function buildSavingsPlanGoalInput(monthlyCents: number): {
  name: string;
  targetCents: number;
  savedCents: number;
  startDate: string;
  targetDate: string;
} {
  const monthly = Math.max(0, Math.round(monthlyCents));
  const start = new Date();
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  const end = new Date(start.getFullYear(), start.getMonth() + SAVINGS_PLAN_HORIZON_MONTHS, 1);
  const targetDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-01`;
  return {
    name: ONBOARDING_MONTHLY_SAVINGS_GOAL_NAME,
    targetCents: monthly * SAVINGS_PLAN_HORIZON_MONTHS,
    savedCents: 0,
    startDate,
    targetDate,
  };
}

/**
 * Merge cycle-scoped and legacy rows without double counting.
 * Prefer cycle_id rows; legacy date-window rows only when no cycle row exists for that goal.
 */
export function mergeCycleContributions(params: {
  cycleId: string;
  cycleIdRows: CycleContributionRow[];
  legacyRows: CycleContributionRow[];
}): Record<string, number> {
  const { cycleId, cycleIdRows, legacyRows } = params;
  const result: Record<string, number> = {};
  const goalsWithCycleRow = new Set<string>();

  for (const row of cycleIdRows) {
    if (row.cycle_id !== cycleId) continue;
    const amount = Number(row.amount_cents) || 0;
    if (amount <= 0) continue;
    goalsWithCycleRow.add(row.goal_id);
    result[row.goal_id] = (result[row.goal_id] ?? 0) + amount;
  }

  for (const row of legacyRows) {
    if (row.cycle_id != null) continue;
    if (goalsWithCycleRow.has(row.goal_id)) continue;
    const amount = Number(row.amount_cents) || 0;
    if (amount <= 0) continue;
    result[row.goal_id] = (result[row.goal_id] ?? 0) + amount;
  }

  return result;
}

/** Final-state validation against planned savings (not available-to-allocate). */
export function validateCycleAllocation(
  amountsByGoal: Record<string, number>,
  plannedSavingsCents: number,
): CycleAllocationValidation {
  let totalCents = 0;
  for (const raw of Object.values(amountsByGoal)) {
    if (!Number.isFinite(raw) || raw < 0) {
      return {
        valid: false,
        totalCents: 0,
        remainingCents: Math.max(0, plannedSavingsCents),
        error: "Amounts cannot be negative.",
      };
    }
    if (!Number.isInteger(raw)) {
      return {
        valid: false,
        totalCents: 0,
        remainingCents: Math.max(0, plannedSavingsCents),
        error: "Use whole-cent amounts only.",
      };
    }
    totalCents += raw;
  }

  const planned = Math.max(0, Math.round(plannedSavingsCents));
  const remainingCents = planned - totalCents;

  if (planned <= 0) {
    return {
      valid: false,
      totalCents,
      remainingCents: 0,
      error: "Savings plan not set. Set your monthly savings plan first.",
    };
  }

  if (totalCents > planned) {
    return {
      valid: false,
      totalCents,
      remainingCents,
      error:
        "Your allocation exceeds this cycle's savings plan. Increase your savings plan first.",
    };
  }

  return { valid: true, totalCents, remainingCents };
}

/** Build complete final-state payload for all eligible goals (empty → 0). */
export function buildCompleteAllocationPayload(
  eligibleGoals: SavingsGoal[],
  amountsByGoal: Record<string, number>,
): Array<{ goal_id: string; amount_cents: number }> {
  return eligibleGoals.map((goal) => {
    const raw = amountsByGoal[goal.id];
    const amount =
      raw === undefined || raw === null || Number.isNaN(Number(raw))
        ? 0
        : Math.max(0, Math.round(Number(raw)));
    return { goal_id: goal.id, amount_cents: amount };
  });
}

export function parseAmountInputToCents(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const euros = Number.parseFloat(trimmed);
  if (!Number.isFinite(euros) || euros < 0) return Number.NaN;
  return Math.round(euros * 100);
}

/** Display-only recommended monthly saving for an allocation goal card. */
export function recommendedMonthlySavingCents(goal: SavingsGoal): number {
  return calculateGoalPlan(goal).monthlyRequiredSavingCents;
}
