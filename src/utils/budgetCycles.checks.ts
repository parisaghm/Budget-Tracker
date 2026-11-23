import { parseISO } from "date-fns";
import type { BudgetCycle } from "@/types/budgetCycle";
import type { IncomeCycle } from "@/types/incomeCycle";
import {
  computeCycleEndIso,
  defaultExpenseDateForBudgetCycle,
  findCycleContainingDate,
  incomeCycleFromScheduleType,
  isDateInCycleRange,
  resolveNextCycleWindow,
  scheduleTypeFromIncomeCycle,
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

function cycle(
  startDate: string,
  endDate: string,
  scheduleType: string,
  status: BudgetCycle["status"] = "closed",
): BudgetCycle {
  return {
    id: `${startDate}_${endDate}`,
    userId: "u",
    startDate,
    endDate,
    status,
    scheduleType,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

/**
 * Regression checks for the Nov 15 → Dec 1 bug: payday cycles, February /
 * day 28–31 clamping, half-open boundaries, containment lookup, and the
 * next-cycle fallback when settings are temporarily unavailable.
 */
export function runBudgetCycleRegressionCheck(): { pass: boolean; details: string[] } {
  const details: string[] = [];
  let pass = true;
  const expect = (label: string, actual: unknown, expected: unknown) => {
    if (actual === expected) {
      details.push(`ok: ${label}`);
    } else {
      pass = false;
      details.push(`FAIL: ${label} — expected ${String(expected)}, got ${String(actual)}`);
    }
  };

  const monthly15: IncomeCycle = { preset: "monthly_15" };
  expect("monthly_15 Nov 15 → Dec 15", computeCycleEndIso(monthly15, "2026-11-15"), "2026-12-15");
  expect("monthly_15 Dec 15 → Jan 15", computeCycleEndIso(monthly15, "2026-12-15"), "2027-01-15");

  // February and end-of-month paydays (clamped to the month's last day).
  const custom = (day: number): IncomeCycle => ({ preset: "custom", day });
  expect("custom 28 Jan 28 → Feb 28", computeCycleEndIso(custom(28), "2027-01-28"), "2027-02-28");
  expect("custom 29 Jan 29 → Feb 28 (non-leap)", computeCycleEndIso(custom(29), "2027-01-29"), "2027-02-28");
  expect("custom 29 Jan 29 → Feb 29 (leap)", computeCycleEndIso(custom(29), "2028-01-29"), "2028-02-29");
  expect("custom 30 Jan 30 → Feb 28", computeCycleEndIso(custom(30), "2027-01-30"), "2027-02-28");
  expect("custom 30 Feb 28 → Mar 30", computeCycleEndIso(custom(30), "2027-02-28"), "2027-03-30");
  expect("custom 31 Jan 31 → Feb 28", computeCycleEndIso(custom(31), "2027-01-31"), "2027-02-28");
  expect("custom 31 Feb 28 → Mar 31", computeCycleEndIso(custom(31), "2027-02-28"), "2027-03-31");
  expect("custom 31 Mar 31 → Apr 30", computeCycleEndIso(custom(31), "2027-03-31"), "2027-04-30");
  expect(
    "monthly_last Feb 28 → Mar 31",
    computeCycleEndIso({ preset: "monthly_last" }, "2027-02-28"),
    "2027-03-31",
  );

  // Half-open [start, end): the end day belongs to the next cycle.
  const nov = cycle("2026-11-15", "2026-12-15", "monthly_15", "active");
  const dec = cycle("2026-12-15", "2027-01-15", "monthly_15", "scheduled");
  expect("Dec 14 in Nov15–Dec15", isDateInCycleRange("2026-12-14", nov.startDate, nov.endDate), true);
  expect("Dec 15 not in Nov15–Dec15", isDateInCycleRange("2026-12-15", nov.startDate, nov.endDate), false);
  expect("Dec 15 in Dec15–Jan15", isDateInCycleRange("2026-12-15", dec.startDate, dec.endDate), true);

  // Resolver uses date containment, not status or month label.
  const oct = cycle("2026-10-15", "2026-11-15", "monthly_15", "active");
  expect(
    "containment ignores status",
    findCycleContainingDate([oct, nov, dec], "2026-11-20")?.id,
    nov.id,
  );
  expect(
    "Dec 15 resolves to the Dec cycle",
    findCycleContainingDate([oct, nov, dec], "2026-12-15")?.id,
    dec.id,
  );

  // Schedule type ↔ income cycle round-trip.
  for (const schedule of [
    { preset: "monthly_1" },
    { preset: "monthly_15" },
    { preset: "monthly_last" },
    { preset: "custom", day: 27 },
  ] as IncomeCycle[]) {
    const type = scheduleTypeFromIncomeCycle(schedule);
    expect(`round-trip ${type}`, scheduleTypeFromIncomeCycle(incomeCycleFromScheduleType(type)), type);
  }
  expect("calendar_month has no payday", incomeCycleFromScheduleType("calendar_month"), null);
  expect("legacy_month has no payday", incomeCycleFromScheduleType("legacy_month"), null);
  expect("custom:0 rejected", incomeCycleFromScheduleType("custom:0"), null);

  // Settings temporarily unavailable: continue the frozen payday schedule.
  const next = resolveNextCycleWindow({ incomeCycle: null, latest: oct });
  expect("null settings after monthly_15 → start Nov 15", next.startDate, "2026-11-15");
  expect("null settings after monthly_15 → end Dec 15 (never Dec 1)", next.endDate, "2026-12-15");
  expect("null settings keeps schedule_type", next.scheduleType, "monthly_15");
  const configured = resolveNextCycleWindow({ incomeCycle: monthly15, latest: oct });
  expect("configured monthly_15 → Dec 15", configured.endDate, "2026-12-15");
  const calendar = resolveNextCycleWindow({
    incomeCycle: null,
    latest: cycle("2026-10-01", "2026-11-01", "calendar_month"),
  });
  expect("calendar_month user still gets next 1st", calendar.endDate, "2026-12-01");

  // A malformed frozen row is read as-is, never silently rewritten.
  const malformed = cycle("2026-11-15", "2026-12-01", "calendar_month", "active");
  const resolved = findCycleContainingDate([oct, malformed], "2026-11-20");
  expect("malformed row returned unchanged (end)", resolved?.endDate, "2026-12-01");
  expect("malformed row: Dec 5 not covered", findCycleContainingDate([oct, malformed], "2026-12-05"), null);
  expect("malformed row object untouched", malformed.endDate, "2026-12-01");

  return { pass, details };
}

if (import.meta.env?.DEV) {
  // Available for manual console checks
  (globalThis as unknown as { __runBudgetCycleTransitionCheck?: typeof runBudgetCycleTransitionCheck })
    .__runBudgetCycleTransitionCheck = runBudgetCycleTransitionCheck;
  (globalThis as unknown as { __runBudgetCycleRegressionCheck?: typeof runBudgetCycleRegressionCheck })
    .__runBudgetCycleRegressionCheck = runBudgetCycleRegressionCheck;
}
