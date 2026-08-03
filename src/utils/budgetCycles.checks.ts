import { parseISO } from "date-fns";
import type { IncomeCycle } from "@/types/incomeCycle";
import {
  computeCycleEndIso,
  defaultExpenseDateForBudgetCycle,
  isDateInCycleRange,
} from "@/utils/budgetCycles";

/** Dev/acceptance checks for half-open cycles and schedule-change transitions. */
export function runBudgetCycleTransitionCheck(): {
  pass: boolean;
  details: string[];
} {
  const details: string[] = [];
  let pass = true;

  // Cross-month cycle: today in August must still stamp today, not Jul 1.
  const crossMonth = { startDate: "2026-07-27", endDate: "2026-08-27" };
  const todayInCycle = defaultExpenseDateForBudgetCycle(crossMonth, "2026-07", "2026-08-03");
  if (todayInCycle !== "2026-08-03") {
    pass = false;
    details.push(`expected today in cycle → 2026-08-03, got ${todayInCycle}`);
  } else {
    details.push("default expense date uses today across month boundary");
  }
  const pastCycleDate = defaultExpenseDateForBudgetCycle(crossMonth, "2026-07", "2026-09-01");
  if (pastCycleDate !== "2026-08-26") {
    pass = false;
    details.push(`expected last day of past cycle → 2026-08-26, got ${pastCycleDate}`);
  } else {
    details.push("past cycle defaults to last inclusive day");
  }

  const monthly15: IncomeCycle = { preset: "monthly_15" };
  const monthly1: IncomeCycle = { preset: "monthly_1" };

  const start = "2026-07-15";
  const end = computeCycleEndIso(monthly15, start);
  if (end !== "2026-08-15") {
    pass = false;
    details.push(`expected Jul15→Aug15, got ${end}`);
  } else {
    details.push(`monthly_15: ${start} → ${end}`);
  }

  // Transition after schedule change to monthly_1: next starts at previous end
  const transitionStart = end;
  const transitionEnd = computeCycleEndIso(monthly1, transitionStart);
  if (transitionEnd !== "2026-09-01") {
    pass = false;
    details.push(`expected Aug15→Sep1 transition, got ${transitionEnd}`);
  } else {
    details.push(`transition: ${transitionStart} → ${transitionEnd}`);
  }

  const nextStart = transitionEnd;
  const nextEnd = computeCycleEndIso(monthly1, nextStart);
  if (nextEnd !== "2026-10-01") {
    pass = false;
    details.push(`expected Sep1→Oct1, got ${nextEnd}`);
  } else {
    details.push(`future: ${nextStart} → ${nextEnd}`);
  }

  // Half-open membership: end date belongs to next cycle
  if (!isDateInCycleRange("2026-07-15", start, end)) {
    pass = false;
    details.push("start date should be included");
  }
  if (isDateInCycleRange("2026-08-15", start, end)) {
    pass = false;
    details.push("end date must be exclusive");
  }
  if (!isDateInCycleRange("2026-08-15", transitionStart, transitionEnd)) {
    pass = false;
    details.push("Aug 15 should belong to transition cycle");
  }

  // No gap between consecutive cycles
  if (transitionStart !== end || nextStart !== transitionEnd) {
    pass = false;
    details.push("gap detected between consecutive cycle boundaries");
  }

  void parseISO(start);
  return { pass, details };
}

if (import.meta.env?.DEV) {
  // Available for manual console checks
  (globalThis as unknown as { __runBudgetCycleTransitionCheck?: typeof runBudgetCycleTransitionCheck })
    .__runBudgetCycleTransitionCheck = runBudgetCycleTransitionCheck;
}
