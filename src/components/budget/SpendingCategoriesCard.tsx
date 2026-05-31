import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus } from "lucide-react";
import type { CategoryDef, Expense } from "@/types/finance";
import { formatMoney, eurosToCents, centsToEuros, getCurrencySymbol } from "@/utils/money";
import { getCategoryIcon } from "@/utils/categoryIcons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

function categoryStatusText(
  spent: number,
  limitCents: number | undefined,
  currency: string,
): string {
  if (limitCents == null || limitCents <= 0) {
    return `Spent ${formatMoney(spent, currency)} this month`;
  }
  const remaining = limitCents - spent;
  if (remaining <= 0) {
    return `${formatMoney(0, currency)} left this month · close to limit`;
  }
  if (remaining <= limitCents * 0.15) {
    return `${formatMoney(remaining, currency)} left this month · close to limit`;
  }
  return `${formatMoney(remaining, currency)} left this month`;
}

export interface SpendingCategoriesCardProps {
  expenses: Expense[];
  categories: CategoryDef[];
  currency?: string;
  categoryLimits?: Record<string, number>;
  onSetCategoryLimit?: (categoryValue: string, limitCents: number) => void;
}

export function SpendingCategoriesCard({
  expenses,
  categories,
  currency = "EUR",
  categoryLimits = {},
  onSetCategoryLimit,
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

  const visibleCategories = categories.filter((cat) => {
    const spent = spentByCategory[cat.value] || 0;
    const limit = categoryLimits[cat.value];
    return spent > 0 || (limit != null && limit > 0);
  });

  const list = visibleCategories.length > 0 ? visibleCategories : categories;

  return (
    <section className="card-elevated p-5 sm:p-6" aria-labelledby="spending-categories-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="spending-categories-heading"
            className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            Spending categories
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {plannedTotal > 0 ? (
              <>
                Planned {formatMoney(plannedTotal, currency)} · spent {formatMoney(spentTotal, currency)}
              </>
            ) : (
              "Tap to adjust limits"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/expenses"
            className="btn-icon h-9 w-9"
            aria-label="Edit categories on expenses page"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
          <Link to="/expenses" className="btn-primary gap-1.5 px-4 py-2 text-sm">
            <Plus className="h-4 w-4" aria-hidden />
            Category
          </Link>
        </div>
      </div>

      <ul className="mt-5 space-y-5" role="list">
        {list.map((cat, index) => {
          const spent = spentByCategory[cat.value] || 0;
          const limitCents = categoryLimits[cat.value];
          const hasLimit = limitCents != null && limitCents > 0;
          const pct =
            hasLimit && limitCents > 0 ? Math.min(100, Math.round((spent / limitCents) * 100)) : 0;
          const isNearLimit = hasLimit && spent >= limitCents * 0.85;
          const theme = getCategoryTheme(index);
          const Icon = getCategoryIcon(cat.iconKey);

          return (
            <li key={cat.value}>
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: theme.bg }}
                >
                  <Icon className="h-4 w-4 text-foreground/70" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold leading-tight text-foreground">{cat.label}</p>
                    <p className="money-display shrink-0 text-base sm:text-lg">
                      {formatMoney(spent, currency)}
                      {hasLimit ? (
                        <span className="text-muted-foreground"> / {formatMoney(limitCents, currency)}</span>
                      ) : null}
                    </p>
                  </div>
                  {hasLimit ? (
                    <div className="mt-2.5">
                      <div className="progress-track h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: isNearLimit ? "hsl(var(--destructive))" : theme.bar,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {categoryStatusText(spent, limitCents, currency)}
                  </p>
                  {onSetCategoryLimit ? (
                    <SetLimitPopover
                      categoryLabel={cat.label}
                      currency={currency}
                      currentLimitCents={limitCents ?? 0}
                      onSave={(cents) => onSetCategoryLimit(cat.value, cents)}
                    />
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {plannedTotal > 0 ? (
        <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-sm">
          <span className="text-muted-foreground">Allocated to categories</span>
          <span className="money-display font-semibold">{formatMoney(plannedTotal, currency)}</span>
        </div>
      ) : null}
    </section>
  );
}

function SetLimitPopover({
  categoryLabel,
  currency = "EUR",
  currentLimitCents,
  onSave,
}: {
  categoryLabel: string;
  currency?: string;
  currentLimitCents: number;
  onSave: (limitCents: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(
    currentLimitCents > 0 ? String(centsToEuros(currentLimitCents)) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setInputValue(currentLimitCents > 0 ? String(centsToEuros(currentLimitCents)) : "");
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError("Enter a monthly limit amount.");
      return;
    }
    const euros = parseFloat(trimmed.replace(",", "."));
    if (Number.isNaN(euros) || euros < 0) {
      setError("Enter a valid amount (0 or greater).");
      return;
    }
    setError(null);
    onSave(eurosToCents(euros));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Plus className="h-3 w-3" aria-hidden />
          {currentLimitCents > 0 ? "Edit limit" : "Set limit"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm font-medium text-foreground">{categoryLabel} — monthly limit</p>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 600"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (error) setError(null);
              }}
              className="font-mono"
              aria-invalid={error != null}
            />
            <span className="self-center text-sm text-muted-foreground">{getCurrencySymbol(currency)}</span>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1 rounded-full">
              Save
            </Button>
            {currentLimitCents > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  onSave(0);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
