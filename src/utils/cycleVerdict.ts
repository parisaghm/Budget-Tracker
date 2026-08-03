/**
 * Finished-cycle verdict rules (computed, not persisted).
 *
 * Thresholds:
 * - On plan: spending at or below plan (when plan exists) AND savings fully met
 *   (actual contributions >= planned savings when planned > 0).
 * - Mixed: exactly one of spending/savings succeeded, OR overspend ≤ 5% of plan.
 * - Tough cycle: overspend > 5% of plan and/or savings < 80% of plan when plan > 0.
 * - Unavailable: planned expenses missing and savings plan missing — transparent copy.
 */

export type CycleVerdict = "on_plan" | "mixed" | "tough" | "unavailable";

/** Overspend at or below this fraction of plan counts as Mixed, not Tough. */
export const MIXED_OVERSPEND_FRACTION = 0.05;

/** Savings below this fraction of plan (when plan > 0) is material under-saving. */
export const TOUGH_SAVINGS_FRACTION = 0.8;

export interface CycleVerdictInput {
  /** Total actual spending in the frozen cycle (cents). */
  actualSpentCents: number;
  /**
   * Planned expense total for that cycle when historically available.
   * Null/undefined means category/bill plans were not preserved — do not invent.
   */
  plannedExpensesCents: number | null;
  /** Authoritative planned savings for comparison (may be current meta plan proxy). */
  plannedSavingsCents: number;
  /** Actual goal contribution ledger sum for that cycle. */
  actualContributionsCents: number;
  /** True when planned expense figures exist for this cycle. */
  hasPlannedExpenses: boolean;
}

export interface CycleVerdictResult {
  verdict: CycleVerdict;
  label: string;
  spendingOk: boolean | null;
  savingsOk: boolean | null;
  overPlanCents: number | null;
  underPlanCents: number | null;
}

export function computeCycleVerdict(input: CycleVerdictInput): CycleVerdictResult {
  const {
    actualSpentCents,
    plannedExpensesCents,
    plannedSavingsCents,
    actualContributionsCents,
    hasPlannedExpenses,
  } = input;

  const plan =
    hasPlannedExpenses && plannedExpensesCents != null && plannedExpensesCents > 0
      ? plannedExpensesCents
      : null;

  let spendingOk: boolean | null = null;
  let overPlanCents: number | null = null;
  let underPlanCents: number | null = null;

  if (plan != null) {
    const delta = actualSpentCents - plan;
    spendingOk = delta <= 0;
    overPlanCents = delta > 0 ? delta : 0;
    underPlanCents = delta < 0 ? -delta : 0;
  }

  let savingsOk: boolean | null = null;
  if (plannedSavingsCents > 0) {
    savingsOk = actualContributionsCents >= plannedSavingsCents;
  } else if (actualContributionsCents > 0) {
    savingsOk = true;
  }

  if (spendingOk === null && savingsOk === null) {
    return {
      verdict: "unavailable",
      label: "Unavailable",
      spendingOk,
      savingsOk,
      overPlanCents,
      underPlanCents,
    };
  }

  const overFraction =
    plan != null && plan > 0 && overPlanCents != null ? overPlanCents / plan : 0;
  const savingsFraction =
    plannedSavingsCents > 0 ? actualContributionsCents / plannedSavingsCents : 1;

  const materialOverspend = plan != null && overPlanCents != null && overFraction > MIXED_OVERSPEND_FRACTION;
  const materialUnderSave =
    plannedSavingsCents > 0 && savingsFraction < TOUGH_SAVINGS_FRACTION;

  if (materialOverspend || materialUnderSave) {
    // Small overspend alone can still be Mixed if savings are healthy and overspend ≤ 5%.
    if (
      !materialUnderSave &&
      plan != null &&
      overPlanCents != null &&
      overFraction > 0 &&
      overFraction <= MIXED_OVERSPEND_FRACTION
    ) {
      return {
        verdict: "mixed",
        label: "Mixed",
        spendingOk,
        savingsOk,
        overPlanCents,
        underPlanCents,
      };
    }
    if (materialOverspend || materialUnderSave) {
      return {
        verdict: "tough",
        label: "Tough cycle",
        spendingOk,
        savingsOk,
        overPlanCents,
        underPlanCents,
      };
    }
  }

  if (spendingOk === true && (savingsOk === true || savingsOk === null)) {
    return {
      verdict: "on_plan",
      label: "On plan",
      spendingOk,
      savingsOk,
      overPlanCents,
      underPlanCents,
    };
  }

  if (spendingOk === null && savingsOk === true) {
    return {
      verdict: "on_plan",
      label: "On plan",
      spendingOk,
      savingsOk,
      overPlanCents,
      underPlanCents,
    };
  }

  if (
    (spendingOk === true && savingsOk === false) ||
    (spendingOk === false && savingsOk === true) ||
    (spendingOk === false &&
      plan != null &&
      overPlanCents != null &&
      overFraction <= MIXED_OVERSPEND_FRACTION)
  ) {
    return {
      verdict: "mixed",
      label: "Mixed",
      spendingOk,
      savingsOk,
      overPlanCents,
      underPlanCents,
    };
  }

  if (spendingOk === false || savingsOk === false) {
    return {
      verdict: "tough",
      label: "Tough cycle",
      spendingOk,
      savingsOk,
      overPlanCents,
      underPlanCents,
    };
  }

  return {
    verdict: "on_plan",
    label: "On plan",
    spendingOk,
    savingsOk,
    overPlanCents,
    underPlanCents,
  };
}
