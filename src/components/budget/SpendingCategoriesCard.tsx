import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Pencil, Plus } from "lucide-react";
import type { CategoryDef, Expense } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import { SpendingCategoryRow } from "@/components/budget/SpendingCategoryRow";
import { cn } from "@/lib/utils";

const CATEGORY_PALETTE = [
  { bar: "hsl(278 24% 38%)", bg: "hsl(278 24% 38% / 0.12)" },
  { bar: "hsl(32 42% 58%)", bg: "hsl(32 42% 58% / 0.14)" },
  { bar: "hsl(18 52% 58%)", bg: "hsl(18 52% 58% / 0.14)" },
  { bar: "hsl(152 28% 38%)", bg: "hsl(152 28% 38% / 0.12)" },
  { bar: "hsl(260 8% 58%)", bg: "hsl(260 8% 58% / 0.12)" },
  { bar: "hsl(28 48% 52%)", bg: "hsl(28 48% 52% / 0.14)" },
];

function getCategoryTheme(index: number) {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

export interface SpendingCategoriesCardProps {
  expenses: Expense[];
  categories: CategoryDef[];
  currency?: string;
  categoryLimits?: Record<string, number>;
  onSetCategoryLimit?: (categoryValue: string, limitCents: number) => void;
  maxVisible?: number;
}

export function SpendingCategoriesCard({
  expenses,
  categories,
  currency = "EUR",
  categoryLimits = {},
  onSetCategoryLimit,
  maxVisible = 6,
}: SpendingCategoriesCardProps) {
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((exp) => {
      map[exp.category] = (map[exp.category] || 0) + exp.amountCents;
    });
    return map;
  }, [expenses]);

  const { plannedTotal, spentTotal } = useMemo(() => {
    let planned = 0;
    let spent = 0;
    categories.forEach((cat) => {
      const limit = categoryLimits[cat.value];
      const catSpent = spentByCategory[cat.value] || 0;
      spent += catSpent;
      if (limit != null && limit > 0) planned += limit;
    });
    return { plannedTotal: planned, spentTotal: spent };
  }, [categories, categoryLimits, spentByCategory]);

  const visibleCategories = useMemo(() => {
    const withActivity = categories.filter((cat) => {
      const spent = spentByCategory[cat.value] || 0;
      const limit = categoryLimits[cat.value];
      return spent > 0 || (limit != null && limit > 0);
    });
    const list = withActivity.length > 0 ? withActivity : categories;
    return list.slice(0, maxVisible);
  }, [categories, categoryLimits, spentByCategory, maxVisible]);

  return (
    <section
      className="spending-categories-card card-dashboard dashboard-card-hover w-full rounded-[1.5rem] p-5 lg:rounded-[1.875rem] lg:p-8"
      aria-labelledby="spending-categories-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="spending-categories-heading" className="heading-card">
            Spending categories
          </h2>
          {plannedTotal > 0 ? (
            <p className="mt-1 hidden text-sm text-muted-foreground min-[641px]:block">
              Planned {formatMoney(plannedTotal, currency)} · spent{" "}
              {formatMoney(spentTotal, currency)}
            </p>
          ) : null}
          <p
            className={cn(
              "mt-1 text-sm text-muted-foreground",
              plannedTotal > 0 ? "max-[640px]:block min-[641px]:hidden" : "block",
            )}
          >
            Tap to adjust limits
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/expenses"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-secondary/60 text-foreground transition-colors hover:bg-secondary min-[641px]:inline-flex"
            aria-label="Edit categories"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            to="/expenses"
            className="spending-categories-card__add-btn max-[640px]:inline-flex min-[641px]:hidden"
            aria-label="Add category"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to="/expenses"
            className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-secondary/60 px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary min-[641px]:inline-flex"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Category
          </Link>
        </div>
      </div>

      <ul className="mt-4 space-y-3.5" role="list">
        {visibleCategories.map((cat, index) => {
          const spent = spentByCategory[cat.value] || 0;
          const limitCents = categoryLimits[cat.value];
          const theme = getCategoryTheme(index);

          return (
            <li key={cat.value}>
              <SpendingCategoryRow
                categoryValue={cat.value}
                categoryLabel={cat.label}
                iconKey={cat.iconKey}
                iconBg={theme.bg}
                fallbackBarColor={theme.bar}
                spentCents={spent}
                limitCents={limitCents}
                currency={currency}
                paletteIndex={index}
                onSetCategoryLimit={
                  onSetCategoryLimit
                    ? (cents) => onSetCategoryLimit(cat.value, cents)
                    : undefined
                }
              />
            </li>
          );
        })}
      </ul>

      <Link
        to="/expenses"
        className="mt-3 hidden items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80 min-[641px]:inline-flex"
      >
        View all categories
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>

      {plannedTotal > 0 ? (
        <div className="mt-4 hidden items-center justify-between border-t border-border/60 pt-4 text-sm min-[641px]:flex">
          <span className="text-muted-foreground">Allocated to categories</span>
          <span className="money-display font-semibold">{formatMoney(plannedTotal, currency)}</span>
        </div>
      ) : null}
    </section>
  );
}
