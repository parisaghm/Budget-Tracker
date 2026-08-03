import type { CategoryDef, Expense } from "@/types/finance";
import { buildExpensesPageModel } from "@/utils/expensesPageModel";

/** Dev/acceptance checks for expenses page model. */
export function runExpensesPageModelChecks(): {
  pass: boolean;
  details: string[];
} {
  const details: string[] = [];
  let pass = true;

  const categories: CategoryDef[] = [
    { id: "groceries", value: "groceries", label: "Groceries", iconKey: "shopping-cart", isCustom: false },
    { id: "coffee", value: "coffee", label: "Coffee", iconKey: "food", isCustom: true },
  ];

  const expenses: Expense[] = [
    {
      id: "1",
      budgetMonthId: "bm",
      month: "2026-07",
      amountCents: 2450,
      category: "groceries",
      date: "2026-07-27",
      note: "K-Market",
      createdAt: "2026-07-27T18:24:00Z",
    },
    {
      id: "2",
      budgetMonthId: "bm",
      month: "2026-07",
      amountCents: 420,
      category: "coffee",
      date: "2026-07-27",
      note: "Aalto Coffee",
      createdAt: "2026-07-27T10:00:00Z",
    },
    {
      id: "3",
      budgetMonthId: "bm",
      month: "2026-07",
      amountCents: 1280,
      category: "groceries",
      date: "2026-07-26",
      note: "Paid recurring bill: Rent",
      createdAt: "2026-07-26T09:00:00Z",
    },
  ];

  const model = buildExpensesPageModel({
    expenses,
    categories,
    categoryLimits: { groceries: 20000, coffee: 2000 },
    selectedCategory: "all",
    searchQuery: "",
    showBillGeneratedOnly: false,
    showUncategorisedOnly: false,
    homeSpentCents: 4150,
    locale: "en-GB",
    now: new Date(2026, 6, 27),
  });

  if (model.totalCycleSpendingCents !== 4150) {
    pass = false;
    details.push(`total expected 4150, got ${model.totalCycleSpendingCents}`);
  } else {
    details.push("cycle total ok");
  }

  if (!model.reconciliation.ok) {
    pass = false;
    details.push(...model.reconciliation.warnings);
  } else {
    details.push("reconciliation ok");
  }

  if (model.dateGroups.length !== 2) {
    pass = false;
    details.push(`expected 2 date groups, got ${model.dateGroups.length}`);
  } else {
    details.push("date groups ok");
  }

  // Transaction date grouping must ignore created_at and strip timestamptz suffixes.
  const stamped: Expense[] = [
    {
      id: "ts-1",
      budgetMonthId: "bm",
      month: "2026-08",
      amountCents: 100,
      category: "groceries",
      date: "2026-08-03T21:00:00.000Z",
      note: "Late grocery",
      createdAt: "2026-08-02T01:00:00Z",
    },
    {
      id: "ts-2",
      budgetMonthId: "bm",
      month: "2026-08",
      amountCents: 200,
      category: "groceries",
      date: "2026-08-03",
      note: "Same day",
      createdAt: "2026-08-03T12:00:00Z",
    },
  ];
  const stampedModel = buildExpensesPageModel({
    expenses: stamped,
    categories,
    categoryLimits: { groceries: 20000 },
    selectedCategory: "all",
    searchQuery: "",
    showBillGeneratedOnly: false,
    showUncategorisedOnly: false,
    homeSpentCents: 300,
    locale: "en-GB",
    now: new Date(2026, 7, 3),
  });
  if (stampedModel.dateGroups.length !== 1 || stampedModel.dateGroups[0]?.dateYmd !== "2026-08-03") {
    pass = false;
    details.push("timestamp dates must group by transaction YYYY-MM-DD, not created_at");
  } else {
    details.push("transaction-date grouping ok");
  }

  const filtered = buildExpensesPageModel({
    expenses,
    categories,
    categoryLimits: { groceries: 20000, coffee: 2000 },
    selectedCategory: "coffee",
    searchQuery: "aalto",
    showBillGeneratedOnly: false,
    showUncategorisedOnly: false,
    homeSpentCents: 4150,
    locale: "en-GB",
    now: new Date(2026, 6, 27),
  });

  if (filtered.filteredCount !== 1 || filtered.filteredTotalCents !== 420) {
    pass = false;
    details.push("category+search filter failed");
  } else {
    details.push("category+search filter ok");
  }

  return { pass, details };
}
