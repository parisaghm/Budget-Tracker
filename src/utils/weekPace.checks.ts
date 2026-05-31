import { addDays, format, startOfWeek } from "date-fns";
import type { Expense } from "@/types/finance";
import { getCurrentMonth } from "@/utils/money";
import { buildWeekPaceData } from "@/utils/weekPace";

/**
 * Acceptance scenario — Mon €100, Tue €50, rest €0 → week total €150, bars match.
 * Run in dev tools: `import { runWeekPaceAcceptanceCheck } from '@/utils/weekPace.checks'`
 */
export function runWeekPaceAcceptanceCheck(today = new Date()): {
  pass: boolean;
  spentThisWeekCents: number;
  mondayCents: number;
  tuesdayCents: number;
  hasHistory: boolean;
} {
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const mondayIso = format(weekStart, "yyyy-MM-dd");
  const tuesdayIso = format(addDays(weekStart, 1), "yyyy-MM-dd");
  const currentMonth = getCurrentMonth();

  const expenses: Expense[] = [
    {
      id: "check-mon",
      budgetMonthId: "check",
      month: currentMonth,
      amountCents: 10_000,
      category: "other",
      date: mondayIso,
      note: "",
      createdAt: new Date().toISOString(),
    },
    {
      id: "check-tue",
      budgetMonthId: "check",
      month: currentMonth,
      amountCents: 5_000,
      category: "other",
      date: tuesdayIso,
      note: "",
      createdAt: new Date().toISOString(),
    },
  ];

  const data = buildWeekPaceData({ expenses, currentMonth, today });
  const mondayCents = data.days[0]?.amountCents ?? 0;
  const tuesdayCents = data.days[1]?.amountCents ?? 0;
  const barSum = data.days.reduce((sum, day) => sum + day.amountCents, 0);

  const pass =
    mondayCents === 10_000 &&
    tuesdayCents === 5_000 &&
    data.spentThisWeekCents === 15_000 &&
    barSum === 15_000 &&
    !data.hasHistory;

  return {
    pass,
    spentThisWeekCents: data.spentThisWeekCents,
    mondayCents,
    tuesdayCents,
    hasHistory: data.hasHistory,
  };
}
