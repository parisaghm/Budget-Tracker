import { useState } from "react";
import { SpendingCategoryDonut } from "@/components/expenses/SpendingCategoryDonut";
import { SpendingCategoryRow } from "@/components/expenses/SpendingCategoryRow";
import { BudgetAttentionCallout } from "@/components/expenses/BudgetAttentionCallout";
import type {
  ExpensesCategoryBreakdownItem,
  ExpensesAttentionModel,
  ExpensesCategoryFilter,
} from "@/utils/expensesPageModel";
import { cn } from "@/lib/utils";

interface ExpensesCycleSummaryCardProps {
  breakdown: ExpensesCategoryBreakdownItem[];
  visibleRows: ExpensesCategoryBreakdownItem[];
  hasMoreCategories: boolean;
  totalCycleSpendingCents: number;
  plannedExpenseTotalCents: number;
  hasPlannedExpenses: boolean;
  selectedCategory: ExpensesCategoryFilter;
  selectedBreakdown: ExpensesCategoryBreakdownItem | null;
  attention: ExpensesAttentionModel;
  currency: string;
  onSelectCategory: (category: ExpensesCategoryFilter) => void;
  className?: string;
}

export function ExpensesCycleSummaryCard({
  breakdown,
  visibleRows,
  hasMoreCategories,
  totalCycleSpendingCents,
  plannedExpenseTotalCents,
  hasPlannedExpenses,
  selectedCategory,
  selectedBreakdown,
  attention,
  currency,
  onSelectCategory,
  className,
}: ExpensesCycleSummaryCardProps) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? breakdown : visibleRows;

  const handleSelect = (value: string) => {
    onSelectCategory(selectedCategory === value ? "all" : value);
  };

  return (
    <section
      className={cn(
        "card-dashboard flex flex-col gap-5 rounded-[1.5rem] border border-[#E8DFCC] p-5 sm:p-6",
        className,
      )}
    >
      <header>
        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Spending by category
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This cycle · tap a category to filter the list
        </p>
      </header>

      <SpendingCategoryDonut
        breakdown={breakdown}
        totalCycleSpendingCents={totalCycleSpendingCents}
        plannedExpenseTotalCents={plannedExpenseTotalCents}
        hasPlannedExpenses={hasPlannedExpenses}
        selectedCategory={selectedCategory}
        selectedBreakdown={selectedBreakdown}
        currency={currency}
        onSelectCategory={onSelectCategory}
      />

      {rows.length > 0 ? (
        <div className="space-y-0.5">
          <ul className="max-h-[22rem] space-y-0.5 overflow-y-auto overscroll-contain pr-0.5">
            {rows.map((item) => (
              <li key={item.categoryValue}>
                <SpendingCategoryRow
                  item={item}
                  currency={currency}
                  selected={selectedCategory === item.categoryValue}
                  onSelect={() => handleSelect(item.categoryValue)}
                />
              </li>
            ))}
          </ul>
          {hasMoreCategories ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 w-full rounded-xl px-2 py-2 text-center text-xs font-semibold text-primary hover:bg-[#EFE7F7]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {showAll ? "Show fewer categories" : "View all categories"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Category breakdown appears once you add expenses.
        </p>
      )}

      <BudgetAttentionCallout
        attention={
          hasPlannedExpenses
            ? attention
            : {
                ...attention,
                tone: "no_budget",
                message: "No expense plan set. Assign category budgets to track limits.",
                needsAction: true,
              }
        }
        hasPlannedExpenses={hasPlannedExpenses}
      />
    </section>
  );
}
