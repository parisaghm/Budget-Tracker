import { formatMoney } from "@/utils/money";

export interface SafeToSpendInput {
  incomeForCurrentCycleCents: number;
  spentSoFarCents: number;
  upcomingBillsBeforeIncomeDateCents: number;
  savingsGoalsForCurrentCycleCents: number;
  rolloverBoostCents?: number;
  pausedGoalsBoostCents?: number;
  /** Cents moved from goal allocations back into spending this cycle. */
  goalReallocationBoostCents?: number;
}

/** Safe money left to spend in the current income cycle. */
export function computeSafeToSpendCents(input: SafeToSpendInput): number {
  const {
    incomeForCurrentCycleCents,
    spentSoFarCents,
    upcomingBillsBeforeIncomeDateCents,
    savingsGoalsForCurrentCycleCents,
    rolloverBoostCents = 0,
    pausedGoalsBoostCents = 0,
    goalReallocationBoostCents = 0,
  } = input;

  const activeSavingsCents = Math.max(
    0,
    savingsGoalsForCurrentCycleCents - pausedGoalsBoostCents - goalReallocationBoostCents,
  );

  return (
    incomeForCurrentCycleCents +
    rolloverBoostCents -
    spentSoFarCents -
    upcomingBillsBeforeIncomeDateCents -
    activeSavingsCents
  );
}

export type SafeToSpendStatus = "action_needed" | "tight" | "on_track";

/** Status from safe-to-spend amount and days remaining at the current daily pace. */
export function resolveSafeToSpendStatus(
  safeToSpendCents: number,
  daysRemaining: number,
  dailyPaceCents: number,
): SafeToSpendStatus {
  if (safeToSpendCents < 0) return "action_needed";

  if (
    daysRemaining > 0 &&
    dailyPaceCents > 0 &&
    safeToSpendCents < dailyPaceCents * daysRemaining
  ) {
    return "tight";
  }

  return "on_track";
}

export interface SafeToSpendBreakdown {
  salaryCents: number;
  totalSpentCents: number;
  upcomingBillsCents: number;
  savingsAllocationCents: number;
  rolloverBoostCents?: number;
  pausedGoalsBoostCents?: number;
  goalReallocationBoostCents?: number;
}

export interface SafeToSpendBreakdownLine {
  label: string;
  amountCents: number;
  kind: "income" | "deduction" | "total";
}

export function buildSafeToSpendBreakdownLines(
  breakdown: SafeToSpendBreakdown,
): SafeToSpendBreakdownLine[] {
  const {
    salaryCents,
    totalSpentCents,
    upcomingBillsCents,
    savingsAllocationCents,
    rolloverBoostCents = 0,
    pausedGoalsBoostCents = 0,
    goalReallocationBoostCents = 0,
  } = breakdown;

  const activeSavingsCents = Math.max(
    0,
    savingsAllocationCents - pausedGoalsBoostCents - goalReallocationBoostCents,
  );
  const lines: SafeToSpendBreakdownLine[] = [
    { label: "Income", amountCents: salaryCents, kind: "income" },
  ];

  if (rolloverBoostCents > 0) {
    lines.push({
      label: "Carried over",
      amountCents: rolloverBoostCents,
      kind: "income",
    });
  }

  if (totalSpentCents > 0) {
    lines.push({
      label: "Spent so far",
      amountCents: totalSpentCents,
      kind: "deduction",
    });
  }

  if (upcomingBillsCents > 0) {
    lines.push({
      label: "Upcoming bills",
      amountCents: upcomingBillsCents,
      kind: "deduction",
    });
  }

  if (activeSavingsCents > 0) {
    lines.push({
      label: "Goals / savings",
      amountCents: activeSavingsCents,
      kind: "deduction",
    });
  }

  const resultCents = computeSafeToSpendCents({
    incomeForCurrentCycleCents: salaryCents,
    spentSoFarCents: totalSpentCents,
    upcomingBillsBeforeIncomeDateCents: upcomingBillsCents,
    savingsGoalsForCurrentCycleCents: savingsAllocationCents,
    rolloverBoostCents,
    pausedGoalsBoostCents,
    goalReallocationBoostCents,
  });

  lines.push({
    label: "Left in this cycle",
    amountCents: resultCents,
    kind: "total",
  });

  return lines;
}

/** Plain-language explanation when left-in-cycle is zero or negative. */
export function describeDashboardSafeToSpend(
  remainingCents: number,
  breakdown: SafeToSpendBreakdown,
  currency: string,
): string | null {
  if (remainingCents > 0) return null;

  const { salaryCents, totalSpentCents, upcomingBillsCents, savingsAllocationCents } = breakdown;
  const zeroLabel = formatMoney(0, currency);
  const reasons: string[] = [];

  if (totalSpentCents > 0 && totalSpentCents >= salaryCents) {
    reasons.push(
      `you have spent ${formatMoney(totalSpentCents, currency)} of your ${formatMoney(salaryCents, currency)} income`,
    );
  } else if (totalSpentCents > 0) {
    reasons.push(`${formatMoney(totalSpentCents, currency)} in spending so far`);
  }

  if (upcomingBillsCents > 0) {
    reasons.push(
      `${formatMoney(upcomingBillsCents, currency)} in upcoming bills before your income date`,
    );
  }

  if (savingsAllocationCents > 0) {
    reasons.push(`${formatMoney(savingsAllocationCents, currency)} reserved for savings goals`);
  }

  if (reasons.length === 0) {
    return remainingCents < 0
      ? `Your commitments exceed your income this cycle, so nothing is left (${zeroLabel}).`
      : `Nothing is left for everyday spending after your income, bills, and savings this cycle (${zeroLabel}).`;
  }

  const joined =
    reasons.length === 1
      ? reasons[0]
      : `${reasons.slice(0, -1).join(", ")} and ${reasons[reasons.length - 1]}`;

  if (remainingCents < 0) {
    return `Left in this cycle is ${formatMoney(remainingCents, currency)} because ${joined}.`;
  }

  return `Nothing is left in this cycle (${zeroLabel}) because ${joined}.`;
}
