import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { CategoryDef, Expense } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import { CategoryIconAvatar } from "@/components/CategoryIconAvatar";
import { Button } from "@/components/ui/button";

const CATEGORY_PALETTE = [
  { bar: "hsl(278 24% 38%)", bg: "hsl(278 24% 38% / 0.12)" },
  { bar: "hsl(32 42% 58%)", bg: "hsl(32 42% 58% / 0.14)" },
  { bar: "hsl(18 52% 58%)", bg: "hsl(18 52% 58% / 0.14)" },
  { bar: "hsl(152 28% 38%)", bg: "hsl(152 28% 38% / 0.12)" },
  { bar: "hsl(260 8% 58%)", bg: "hsl(260 8% 58% / 0.12)" },
];

export interface TopSpendingCategoriesCardProps {
  expenses: Expense[];
  categories: CategoryDef[];
  currency?: string;
  maxVisible?: number;
}

export function TopSpendingCategoriesCard({
  expenses,
  categories,
  currency = "EUR",
  maxVisible = 5,
}: TopSpendingCategoriesCardProps) {
  const topCategories = useMemo(() => {
    const spentByCategory: Record<string, number> = {};
    expenses.forEach((exp) => {
      spentByCategory[exp.category] = (spentByCategory[exp.category] || 0) + exp.amountCents;
    });

    const totalSpent = Object.values(spentByCategory).reduce((sum, amount) => sum + amount, 0);

    return categories
      .map((cat) => ({
        category: cat,
        spentCents: spentByCategory[cat.value] || 0,
        percent:
          totalSpent > 0
            ? Math.round(((spentByCategory[cat.value] || 0) / totalSpent) * 100)
            : 0,
      }))
      .filter((item) => item.spentCents > 0)
      .sort((a, b) => b.spentCents - a.spentCents)
      .slice(0, maxVisible);
  }, [categories, expenses, maxVisible]);

  return (
    <section
      className="card-dashboard dashboard-card-hover dashboard-card-fill w-full rounded-[1.5rem] p-5 lg:rounded-[1.875rem] lg:p-6"
      aria-labelledby="top-categories-heading"
    >
      <h2 id="top-categories-heading" className="heading-card">
        Top spending categories
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Where your money went this month</p>

      {topCategories.length === 0 ? (
        <div className="dashboard-empty-state">
          <div
            className="dashboard-empty-icon"
            style={{ backgroundColor: "hsl(32 42% 58% / 0.14)" }}
          >
            <ArrowUpRight className="h-5 w-5 text-warning" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            No spending recorded this month yet. Your top categories will appear here.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-4 rounded-full border-border bg-popover text-foreground hover:bg-accent hover:text-primary"
          >
            <Link to="/expenses">View all expenses</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-3" role="list">
            {topCategories.map((item, index) => {
              return (
                <li key={item.category.value}>
                  <div className="bill-row-lifted flex items-center gap-3 p-3">
                    <CategoryIconAvatar
                      categoryValue={item.category.value}
                      iconKey={item.category.iconKey}
                      label={item.category.label}
                      paletteIndex={index}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.category.label}
                        </p>
                        <p className="money-display shrink-0 text-sm">
                          {formatMoney(item.spentCents, currency)}
                        </p>
                      </div>
                      <div className="mt-2 progress-track h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${item.percent}%`,
                            backgroundColor: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length].bar,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.percent}% of spending
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <Link
            to="/expenses"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            View all expenses
          </Link>
        </>
      )}
    </section>
  );
}
