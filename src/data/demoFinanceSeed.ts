import { addDays, addMonths, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import type {
  BudgetMonth,
  CategoryDef,
  CategoryLimitsByMonth,
  Expense,
  RecurringBill,
  SavingsGoal,
} from "@/types/finance";
import { getCurrentMonth, getPreviousMonth } from "@/utils/money";

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function monthKeyFromIso(dateIso: string): string {
  return dateIso.slice(0, 7);
}

/**
 * Believable, calm sample dataset anchored to “today” so the weekly review and bills stay current.
 */
export function buildDemoFinanceData(now = new Date()): {
  budgets: Record<string, BudgetMonth>;
  expenses: Expense[];
  customCategories: CategoryDef[];
  savingsGoals: SavingsGoal[];
  categoryLimits: CategoryLimitsByMonth;
  recurringBills: RecurringBill[];
} {
  const today = startOfDay(now);
  const currentMonth = getCurrentMonth();
  const previousMonth = getPreviousMonth(currentMonth);

  const budgetIdCurrent = "demo-budget-current";
  const budgetIdPrev = "demo-budget-prev";
  const createdAt = today.toISOString();

  const budgets: Record<string, BudgetMonth> = {
    [currentMonth]: {
      id: budgetIdCurrent,
      month: currentMonth,
      salaryCents: 382_500,
      currency: "EUR",
      createdAt,
      incomeNote: "Net pay (plus a small remote-work stipend this month)",
    },
    [previousMonth]: {
      id: budgetIdPrev,
      month: previousMonth,
      salaryCents: 375_000,
      currency: "EUR",
      createdAt,
      incomeNote: "Regular net pay",
    },
  };

  const customCategories: CategoryDef[] = [
    {
      id: "demo-cat-rent",
      value: "rent",
      label: "Rent",
      iconKey: "home",
      isCustom: true,
    },
    {
      id: "demo-cat-utilities",
      value: "utilities",
      label: "Utilities",
      iconKey: "credit-card",
      isCustom: true,
    },
    {
      id: "demo-cat-transport",
      value: "transport",
      label: "Transport",
      iconKey: "car",
      isCustom: true,
    },
  ];

  const monthStart = startOfMonth(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const expenseSpecs: Array<{
    offsetFromWeekStart: number;
    amountCents: number;
    category: string;
    note: string;
  }> = [
    { offsetFromWeekStart: 0, amountCents: 4_720, category: "groceries", note: "Week shop + fruit" },
    { offsetFromWeekStart: 1, amountCents: 1_850, category: "transport", note: "Transit pass top-up" },
    { offsetFromWeekStart: 2, amountCents: 1_180, category: "other", note: "Coffee with a friend" },
    { offsetFromWeekStart: 3, amountCents: 2_690, category: "entertainment", note: "Film tickets" },
    { offsetFromWeekStart: 4, amountCents: 6_040, category: "groceries", note: "Mid-week bits" },
    { offsetFromWeekStart: 5, amountCents: 3_290, category: "shopping", note: "Replacement headphones" },
  ];

  const expenses: Expense[] = [];
  let expIdx = 0;

  for (const spec of expenseSpecs) {
    const d = addDays(weekStart, spec.offsetFromWeekStart);
    const dateIso = iso(d);
    const month = monthKeyFromIso(dateIso);
    if (month !== currentMonth && month !== previousMonth) continue;

    expenses.push({
      id: `demo-exp-week-${expIdx++}`,
      budgetMonthId: month === currentMonth ? budgetIdCurrent : budgetIdPrev,
      month,
      amountCents: spec.amountCents,
      category: spec.category,
      date: dateIso,
      note: spec.note,
      createdAt,
    });
  }

  const earlierThisMonth = addDays(monthStart, 2);
  if (monthKeyFromIso(iso(earlierThisMonth)) === currentMonth) {
    expenses.push(
      {
        id: "demo-exp-early-1",
        budgetMonthId: budgetIdCurrent,
        month: currentMonth,
        amountCents: 3_450,
        category: "groceries",
        date: iso(earlierThisMonth),
        note: "Pantry refill",
        createdAt,
      },
      {
        id: "demo-exp-early-2",
        budgetMonthId: budgetIdCurrent,
        month: currentMonth,
        amountCents: 2_100,
        category: "other",
        date: iso(addDays(monthStart, 5)),
        note: "Pharmacy",
        createdAt,
      },
    );
  }

  const prevMonthStart = startOfMonth(addMonths(monthStart, -1));
  expenses.push(
    {
      id: "demo-exp-prev-1",
      budgetMonthId: budgetIdPrev,
      month: previousMonth,
      amountCents: 5_180,
      category: "groceries",
      date: iso(addDays(prevMonthStart, 6)),
      note: "Groceries",
      createdAt,
    },
    {
      id: "demo-exp-prev-2",
      budgetMonthId: budgetIdPrev,
      month: previousMonth,
      amountCents: 2_640,
      category: "entertainment",
      date: iso(addDays(prevMonthStart, 14)),
      note: "Concert",
      createdAt,
    },
    {
      id: "demo-exp-prev-3",
      budgetMonthId: budgetIdPrev,
      month: previousMonth,
      amountCents: 1_920,
      category: "transport",
      date: iso(addDays(prevMonthStart, 20)),
      note: "Fuel",
      createdAt,
    },
  );

  const nextRent = startOfMonth(addMonths(today, 1));

  const recurringBills: RecurringBill[] = [
    {
      id: "demo-bill-rent",
      userId: DEMO_USER_ID,
      name: "Rent",
      amountCents: 118_000,
      category: "rent",
      dueDay: 1,
      frequency: "monthly",
      status: "upcoming",
      nextDueDate: iso(nextRent),
      note: "Shared flat",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "demo-bill-power",
      userId: DEMO_USER_ID,
      name: "Electric",
      amountCents: 7_900,
      category: "utilities",
      dueDay: 16,
      frequency: "monthly",
      status: "upcoming",
      nextDueDate: iso(addDays(today, 6)),
      note: "Quarterly true-up a bit higher",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "demo-bill-internet",
      userId: DEMO_USER_ID,
      name: "Internet",
      amountCents: 4_590,
      category: "utilities",
      dueDay: 19,
      frequency: "monthly",
      status: "upcoming",
      nextDueDate: iso(addDays(today, 10)),
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "demo-bill-phone",
      userId: DEMO_USER_ID,
      name: "Mobile",
      amountCents: 3_290,
      category: "utilities",
      dueDay: 22,
      frequency: "monthly",
      status: "upcoming",
      nextDueDate: iso(addDays(today, 13)),
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "demo-bill-streaming",
      userId: DEMO_USER_ID,
      name: "Streaming",
      amountCents: 1_499,
      category: "entertainment",
      dueDay: 12,
      frequency: "monthly",
      status: "upcoming",
      nextDueDate: iso(addDays(today, 3)),
      note: "Bundled plan",
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const goalHorizon = format(addMonths(startOfMonth(today), 8), "yyyy-MM-dd");

  const savingsGoals: SavingsGoal[] = [
    {
      id: "demo-goal-emergency",
      name: "Quiet emergency cushion",
      targetCents: 450_000,
      savedCents: 186_500,
      startDate: iso(addMonths(monthStart, -4)),
      targetDate: goalHorizon,
      createdAt,
    },
    {
      id: "demo-goal-trip",
      name: "Spring train trip",
      targetCents: 95_000,
      savedCents: 41_200,
      startDate: iso(addMonths(monthStart, -2)),
      targetDate: format(addMonths(monthStart, 3), "yyyy-MM-dd"),
      createdAt,
    },
  ];

  const categoryLimits: CategoryLimitsByMonth = {
    [currentMonth]: {
      groceries: 28_000,
      entertainment: 12_000,
    },
  };

  return {
    budgets,
    expenses,
    customCategories,
    savingsGoals,
    categoryLimits,
    recurringBills,
  };
}
