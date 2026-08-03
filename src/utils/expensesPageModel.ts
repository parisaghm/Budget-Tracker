import type { Category, CategoryDef, Expense } from "@/types/finance";
import { getCategoryLabel } from "@/types/finance";
import { BILL_EXPENSE_NOTE_PREFIX } from "@/utils/billsPageModel";
import {
  resolveCategoryManagementStatus,
  type CategoryManagementStatus,
} from "@/utils/categoryBudgetStatus";
import { getCategoryTheme } from "@/utils/categoryTheme";
import { buildSpentByCategory } from "@/utils/budgetPlanning";
import type { IconKey } from "@/utils/categoryIcons";

export const EXPENSES_VISIBLE_CATEGORY_ROWS = 8;

export type ExpensesCategoryFilter = Category | "all";

export interface ExpensesCategoryBreakdownItem {
  categoryValue: string;
  categoryLabel: string;
  iconKey: IconKey | string;
  spentCents: number;
  limitCents: number;
  percentOfTotal: number;
  color: string;
  status: CategoryManagementStatus;
  isKnownCategory: boolean;
}

export interface ExpensesFilterChip {
  value: ExpensesCategoryFilter;
  label: string;
  iconKey?: IconKey | string;
}

export interface ExpensesDateGroup {
  dateYmd: string;
  heading: string;
  dayTotalCents: number;
  expenses: Expense[];
}

export interface ExpensesAttentionModel {
  tone: "healthy" | "near" | "over" | "mixed" | "no_budget";
  message: string;
  nearCategories: ExpensesCategoryBreakdownItem[];
  overCategories: ExpensesCategoryBreakdownItem[];
  noBudgetWithSpend: ExpensesCategoryBreakdownItem[];
  needsAction: boolean;
}

export interface ExpensesReconciliation {
  categorySumCents: number;
  totalCycleSpendingCents: number;
  homeSpentCents: number;
  categoriesMatchTotal: boolean;
  totalMatchesHome: boolean;
  ok: boolean;
  warnings: string[];
}

export interface ExpensesPageModel {
  totalCycleSpendingCents: number;
  plannedExpenseTotalCents: number;
  hasPlannedExpenses: boolean;
  categoryBreakdown: ExpensesCategoryBreakdownItem[];
  visibleCategoryRows: ExpensesCategoryBreakdownItem[];
  hasMoreCategories: boolean;
  visibleFilterChips: ExpensesFilterChip[];
  allFilterCategories: ExpensesFilterChip[];
  filteredExpenses: Expense[];
  filteredCount: number;
  filteredTotalCents: number;
  dateGroups: ExpensesDateGroup[];
  attention: ExpensesAttentionModel;
  reconciliation: ExpensesReconciliation;
  selectedBreakdown: ExpensesCategoryBreakdownItem | null;
  hasActiveFilters: boolean;
  hasSearch: boolean;
}

export interface BuildExpensesPageModelInput {
  expenses: Expense[];
  categories: CategoryDef[];
  categoryLimits: Record<string, number>;
  selectedCategory: ExpensesCategoryFilter;
  searchQuery: string;
  showBillGeneratedOnly: boolean;
  showUncategorisedOnly: boolean;
  homeSpentCents: number;
  locale?: string;
  now?: Date;
  /** When true, include all category rows (not capped). */
  showAllCategories?: boolean;
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isBillGeneratedExpense(expense: Expense): boolean {
  return typeof expense.note === "string" && expense.note.startsWith(BILL_EXPENSE_NOTE_PREFIX);
}

function isUncategorisedExpense(expense: Expense, knownValues: Set<string>): boolean {
  const value = (expense.category ?? "").trim();
  if (!value) return true;
  return !knownValues.has(value);
}

function categoryMeta(
  value: string,
  categories: CategoryDef[],
): { label: string; iconKey: IconKey | string; isKnown: boolean } {
  const found = categories.find((c) => c.value === value);
  if (found) {
    return { label: found.label, iconKey: found.iconKey, isKnown: true };
  }
  if (!value.trim()) {
    return { label: "Uncategorised", iconKey: "wallet", isKnown: false };
  }
  return {
    label: getCategoryLabel(value as Category, categories.filter((c) => c.isCustom)),
    iconKey: "wallet",
    isKnown: false,
  };
}

function formatDayHeading(dateYmd: string, todayYmd: string, locale: string): string {
  const m = dateYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateYmd;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const weekday = date
    .toLocaleDateString(locale, { weekday: "short" })
    .toUpperCase()
    .replace(/\.$/, "");
  const monthDay = date
    .toLocaleDateString(locale, { month: "short", day: "numeric" })
    .toUpperCase();
  if (dateYmd === todayYmd) {
    return `TODAY · ${weekday}, ${monthDay}`;
  }
  return `${weekday}, ${monthDay}`;
}

function buildAttention(breakdown: ExpensesCategoryBreakdownItem[]): ExpensesAttentionModel {
  const overCategories = breakdown.filter((c) => c.status === "over");
  const nearCategories = breakdown.filter((c) => c.status === "near");
  const noBudgetWithSpend = breakdown.filter(
    (c) => c.status === "no_limit" && c.spentCents > 0,
  );

  if (overCategories.length > 0 && nearCategories.length > 0) {
    return {
      tone: "mixed",
      message:
        overCategories.length === 1 && nearCategories.length === 1
          ? `${overCategories[0]!.categoryLabel} is over budget and ${nearCategories[0]!.categoryLabel} is near its limit`
          : `${overCategories.length} over budget · ${nearCategories.length} near limit`,
      nearCategories,
      overCategories,
      noBudgetWithSpend,
      needsAction: true,
    };
  }

  if (overCategories.length > 0) {
    const names = overCategories.slice(0, 2).map((c) => c.categoryLabel);
    const message =
      overCategories.length === 1
        ? `${names[0]} is over budget this cycle`
        : overCategories.length === 2
          ? `${names[0]} and ${names[1]} are over budget`
          : `${overCategories.length} categories are over budget`;
    return {
      tone: "over",
      message,
      nearCategories,
      overCategories,
      noBudgetWithSpend,
      needsAction: true,
    };
  }

  if (nearCategories.length > 0) {
    const names = nearCategories.slice(0, 2).map((c) => c.categoryLabel);
    const message =
      nearCategories.length === 1
        ? `${names[0]} is near its limit this cycle`
        : nearCategories.length === 2
          ? `${names[0]} and ${names[1]} are near their limits`
          : `${nearCategories.length} categories are near their limits`;
    return {
      tone: "near",
      message,
      nearCategories,
      overCategories,
      noBudgetWithSpend,
      needsAction: true,
    };
  }

  if (breakdown.some((c) => c.status === "healthy")) {
    return {
      tone: "healthy",
      message: "Your category spending is within plan.",
      nearCategories,
      overCategories,
      noBudgetWithSpend,
      needsAction: false,
    };
  }

  if (noBudgetWithSpend.length > 0) {
    return {
      tone: "no_budget",
      message:
        noBudgetWithSpend.length === 1
          ? `${noBudgetWithSpend[0]!.categoryLabel} has spending with no budget set`
          : `${noBudgetWithSpend.length} categories have spending with no budget set`,
      nearCategories,
      overCategories,
      noBudgetWithSpend,
      needsAction: true,
    };
  }

  return {
    tone: "healthy",
    message: "Your category spending is within plan.",
    nearCategories,
    overCategories,
    noBudgetWithSpend,
    needsAction: false,
  };
}

function reportReconciliation(rec: ExpensesReconciliation): void {
  if (rec.ok) return;
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    console.warn("[expensesPageModel] reconciliation mismatch", rec);
  }
}

export function buildExpensesPageModel(input: BuildExpensesPageModelInput): ExpensesPageModel {
  const {
    expenses,
    categories,
    categoryLimits,
    selectedCategory,
    searchQuery,
    showBillGeneratedOnly,
    showUncategorisedOnly,
    homeSpentCents,
    locale = typeof navigator !== "undefined" ? navigator.language : "en-GB",
    now = new Date(),
    showAllCategories = false,
  } = input;

  const knownValues = new Set(categories.map((c) => c.value));
  const totalCycleSpendingCents = expenses.reduce((sum, exp) => sum + exp.amountCents, 0);
  const plannedExpenseTotalCents = Object.values(categoryLimits).reduce(
    (sum, v) => sum + Math.max(0, v),
    0,
  );
  const hasPlannedExpenses = plannedExpenseTotalCents > 0;

  const spentByCategory = buildSpentByCategory(expenses);
  const categoryValues = new Set([
    ...Object.keys(spentByCategory),
    ...Object.keys(categoryLimits).filter((k) => (categoryLimits[k] ?? 0) > 0),
  ]);

  const categoryBreakdown: ExpensesCategoryBreakdownItem[] = [...categoryValues]
    .map((value, index) => {
      const spentCents = spentByCategory[value] ?? 0;
      const limitCents = Math.max(0, categoryLimits[value] ?? 0);
      const meta = categoryMeta(value, categories);
      const percentOfTotal =
        totalCycleSpendingCents > 0
          ? Math.round((spentCents / totalCycleSpendingCents) * 100)
          : 0;
      return {
        categoryValue: value || "uncategorised",
        categoryLabel: meta.label,
        iconKey: meta.iconKey,
        spentCents,
        limitCents,
        percentOfTotal,
        color: getCategoryTheme(index).bar,
        status: resolveCategoryManagementStatus(spentCents, limitCents),
        isKnownCategory: meta.isKnown,
      };
    })
    .filter((row) => row.spentCents > 0)
    .sort((a, b) => {
      if (b.spentCents !== a.spentCents) return b.spentCents - a.spentCents;
      return a.categoryLabel.localeCompare(b.categoryLabel);
    })
    .map((row, index) => ({
      ...row,
      color: getCategoryTheme(index).bar,
    }));

  const visibleCategoryRows = showAllCategories
    ? categoryBreakdown
    : categoryBreakdown.slice(0, EXPENSES_VISIBLE_CATEGORY_ROWS);
  const hasMoreCategories = categoryBreakdown.length > EXPENSES_VISIBLE_CATEGORY_ROWS;

  const usageCount = new Map<string, number>();
  for (const exp of expenses) {
    const key = exp.category || "";
    usageCount.set(key, (usageCount.get(key) ?? 0) + 1);
  }

  // Show every known category as a chip (most-used in this cycle first, then A–Z).
  // Also include any selected/spent category that is missing from the catalog.
  const chipValues = new Set<string>(categories.map((c) => c.value));
  for (const value of usageCount.keys()) {
    if (value) chipValues.add(value);
  }
  if (selectedCategory !== "all") {
    chipValues.add(selectedCategory);
  }

  const categoryChips: ExpensesFilterChip[] = [...chipValues]
    .map((value) => {
      const meta = categoryMeta(value, categories);
      return {
        value: value as ExpensesCategoryFilter,
        label: meta.label,
        iconKey: meta.iconKey,
        usage: usageCount.get(value) ?? 0,
        spent: spentByCategory[value] ?? 0,
      };
    })
    .sort((a, b) => {
      if (b.usage !== a.usage) return b.usage - a.usage;
      if (b.spent !== a.spent) return b.spent - a.spent;
      return a.label.localeCompare(b.label);
    })
    .map(({ value, label, iconKey }) => ({ value, label, iconKey }));

  const visibleFilterChips: ExpensesFilterChip[] = [
    { value: "all", label: "All" },
    ...categoryChips,
  ];

  const allFilterCategories: ExpensesFilterChip[] = categoryChips
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasSearch = normalizedQuery.length > 0;

  const filteredExpenses = expenses
    .filter((exp) => {
      if (selectedCategory !== "all" && exp.category !== selectedCategory) return false;
      if (showBillGeneratedOnly && !isBillGeneratedExpense(exp)) return false;
      if (showUncategorisedOnly && !isUncategorisedExpense(exp, knownValues)) return false;
      if (!hasSearch) return true;
      const label = categoryMeta(exp.category, categories).label.toLowerCase();
      const note = (exp.note ?? "").toLowerCase();
      const categoryValue = (exp.category ?? "").toLowerCase();
      return (
        note.includes(normalizedQuery) ||
        label.includes(normalizedQuery) ||
        categoryValue.includes(normalizedQuery)
      );
    })
    .sort((a, b) => {
      const dateDiff = b.date.slice(0, 10).localeCompare(a.date.slice(0, 10));
      if (dateDiff !== 0) return dateDiff;
      const createdDiff = (b.createdAt || "").localeCompare(a.createdAt || "");
      if (createdDiff !== 0) return createdDiff;
      return b.id.localeCompare(a.id);
    });

  const filteredTotalCents = filteredExpenses.reduce((sum, exp) => sum + exp.amountCents, 0);
  const todayYmd = localYmd(now);

  const groupsMap = new Map<string, Expense[]>();
  for (const exp of filteredExpenses) {
    // Group by transaction date (YYYY-MM-DD), never created_at.
    const dateYmd = exp.date.slice(0, 10);
    const list = groupsMap.get(dateYmd) ?? [];
    list.push(exp);
    groupsMap.set(dateYmd, list);
  }

  const dateGroups: ExpensesDateGroup[] = [...groupsMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateYmd, dayExpenses]) => ({
      dateYmd,
      heading: formatDayHeading(dateYmd, todayYmd, locale),
      dayTotalCents: dayExpenses.reduce((sum, exp) => sum + exp.amountCents, 0),
      expenses: dayExpenses,
    }));

  const categorySumCents = categoryBreakdown.reduce((sum, row) => sum + row.spentCents, 0);
  const categoriesMatchTotal = categorySumCents === totalCycleSpendingCents;
  const totalMatchesHome = totalCycleSpendingCents === homeSpentCents;
  const warnings: string[] = [];
  if (!categoriesMatchTotal) {
    warnings.push(
      `Category sum ${categorySumCents} !== cycle total ${totalCycleSpendingCents}`,
    );
  }
  if (!totalMatchesHome) {
    warnings.push(
      `Cycle expense total ${totalCycleSpendingCents} !== Home spent ${homeSpentCents}`,
    );
  }
  const reconciliation: ExpensesReconciliation = {
    categorySumCents,
    totalCycleSpendingCents,
    homeSpentCents,
    categoriesMatchTotal,
    totalMatchesHome,
    ok: categoriesMatchTotal && totalMatchesHome,
    warnings,
  };
  reportReconciliation(reconciliation);

  const selectedBreakdown =
    selectedCategory === "all"
      ? null
      : categoryBreakdown.find((c) => c.categoryValue === selectedCategory) ?? null;

  const hasActiveFilters =
    selectedCategory !== "all" ||
    showBillGeneratedOnly ||
    showUncategorisedOnly ||
    hasSearch;

  return {
    totalCycleSpendingCents,
    plannedExpenseTotalCents,
    hasPlannedExpenses,
    categoryBreakdown,
    visibleCategoryRows,
    hasMoreCategories,
    visibleFilterChips,
    allFilterCategories,
    filteredExpenses,
    filteredCount: filteredExpenses.length,
    filteredTotalCents,
    dateGroups,
    attention: buildAttention(categoryBreakdown),
    reconciliation,
    selectedBreakdown,
    hasActiveFilters,
    hasSearch,
  };
}
