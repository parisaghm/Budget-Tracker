import { computeCycleVerdict } from "@/utils/cycleVerdict";
import {
  computeCycleDayProgress,
  projectCycleSpend,
  clampPercentDisplay,
} from "@/utils/cycleProjection";
import type { BudgetCycle } from "@/types/budgetCycle";

/** Dev/acceptance checks for cycle review utilities. */
export function runCycleReviewModelChecks(): {
  pass: boolean;
  details: string[];
} {
  const details: string[] = [];
  let pass = true;

  const cycle: BudgetCycle = {
    id: "c1",
    userId: "u1",
    startDate: "2026-07-15",
    endDate: "2026-08-15",
    status: "active",
    scheduleType: "monthly_15",
    createdAt: "2026-07-15T00:00:00Z",
  };

  const progress = computeCycleDayProgress(cycle, "2026-07-27");
  if (progress.cycleLength !== 31 || progress.cycleDay !== 13) {
    pass = false;
    details.push(
      `day progress expected day 13 of 31, got ${progress.cycleDay} of ${progress.cycleLength}`,
    );
  } else {
    details.push("cycle day 13 of 31 ok");
  }

  const none = projectCycleSpend({
    actualSpentCents: 1000,
    elapsedDays: 0,
    cycleLength: 31,
  });
  if (none.kind !== "none") {
    pass = false;
    details.push("expected no projection on day 0");
  } else {
    details.push("day 0 projection suppressed");
  }

  const early = projectCycleSpend({
    actualSpentCents: 1000,
    elapsedDays: 1,
    cycleLength: 31,
  });
  if (early.kind !== "early_estimate" || early.projectedSpendCents !== 31000) {
    pass = false;
    details.push(`early estimate unexpected: ${JSON.stringify(early)}`);
  } else {
    details.push("day 1 early estimate ok");
  }

  const full = projectCycleSpend({
    actualSpentCents: 1300,
    elapsedDays: 13,
    cycleLength: 31,
  });
  if (full.kind !== "projected" || full.projectedSpendCents !== 3100) {
    pass = false;
    details.push(`projection unexpected: ${JSON.stringify(full)}`);
  } else {
    details.push("day 13 projection ok");
  }

  const verdict = computeCycleVerdict({
    actualSpentCents: 10000,
    plannedExpensesCents: 12000,
    plannedSavingsCents: 5000,
    actualContributionsCents: 5000,
    hasPlannedExpenses: true,
  });
  if (verdict.verdict !== "on_plan") {
    pass = false;
    details.push(`expected on_plan, got ${verdict.verdict}`);
  } else {
    details.push("verdict on_plan ok");
  }

  const tough = computeCycleVerdict({
    actualSpentCents: 15000,
    plannedExpensesCents: 10000,
    plannedSavingsCents: 5000,
    actualContributionsCents: 1000,
    hasPlannedExpenses: true,
  });
  if (tough.verdict !== "tough") {
    pass = false;
    details.push(`expected tough, got ${tough.verdict}`);
  } else {
    details.push("verdict tough ok");
  }

  if (clampPercentDisplay(1.5) !== 150) {
    pass = false;
    details.push("clampPercentDisplay failed");
  } else {
    details.push("clampPercentDisplay ok");
  }

  return { pass, details };
}
