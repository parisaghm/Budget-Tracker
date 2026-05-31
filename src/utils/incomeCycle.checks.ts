import { format, parseISO } from "date-fns";
import {
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
