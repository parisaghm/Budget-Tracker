import { format, parseISO } from "date-fns";
import {
  formatBudgetMonthSelectorLabel,
  getActiveBudgetMonthKey,
  getCycleWindowForMonthKey,
  getDaysUntilNextIncome,
  getNextIncomeDate,
  presetToIncomeCycle,
} from "@/utils/incomeCycle";

/** May 29 → June 15 = 17 days for monthly 15th income. */
export function runIncomeCycleMay29Check(): { pass: boolean; days: number } {
  const cycle = presetToIncomeCycle("monthly_15");
  const today = parseISO("2026-05-29");
  const days = getDaysUntilNextIncome(cycle, today);
  const next = getNextIncomeDate(cycle, today);
  const pass = days === 17 && format(next, "yyyy-MM-dd") === "2026-06-15";
  return { pass, days };
}

/** May 10 → May 15 = 5 days for monthly 15th income. */
export function runIncomeCycleMay10Check(): { pass: boolean; days: number } {
  const cycle = presetToIncomeCycle("monthly_15");
  const today = parseISO("2026-05-10");
  const days = getDaysUntilNextIncome(cycle, today);
  const pass = days === 5;
  return { pass, days };
}

/** Jun 17 with monthly 15th → active budget month is June (Jun 15 – Jul 15). */
export function runActiveBudgetMonthJun17Check(): { pass: boolean; monthKey: string } {
  const cycle = presetToIncomeCycle("monthly_15");
  const today = parseISO("2026-06-17");
  const monthKey = getActiveBudgetMonthKey(cycle, today);
  const window = getCycleWindowForMonthKey(cycle, monthKey);
  const pass =
    monthKey === "2026-06" &&
    window.startIso === "2026-06-15" &&
    window.endIso === "2026-07-15";
  return { pass, monthKey };
}

/** Active cycle label includes the current-cycle prefix. */
export function runActiveCycleLabelCheck(): { pass: boolean; label: string } {
  const cycle = presetToIncomeCycle("monthly_15");
  const today = parseISO("2026-06-17");
  const monthKey = getActiveBudgetMonthKey(cycle, today);
  const label = formatBudgetMonthSelectorLabel(cycle, monthKey, today);
  const pass = label === "Current cycle · Jun 15 – Jul 15";
  return { pass, label };
}
