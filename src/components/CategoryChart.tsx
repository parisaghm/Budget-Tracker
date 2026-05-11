import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Expense, Category, CategoryDef } from '@/types/finance';
import { formatMoney, eurosToCents, centsToEuros, getCurrencySymbol } from '@/utils/money';
import { BarChart3, Target, Plus } from 'lucide-react';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CategoryChartProps {
  expenses: Expense[];
  categories: CategoryDef[];
  currency?: string;
  /** When user clicks a legend item, filter the expense list by this category. Null = show all. */
  selectedCategory: Category | null;
  onCategorySelect: (category: Category | null) => void;
  /** Per-category monthly limits in cents (for current month). */
  categoryLimits?: Record<string, number>;
  /** Set monthly limit for a category (cents). Pass 0 to clear. */
  onSetCategoryLimit?: (categoryValue: string, limitCents: number) => void;
}

const PALETTE = [
  'hsl(255, 60%, 52%)',
  'hsl(35, 100%, 55%)',
  'hsl(160, 84%, 39%)',
  'hsl(340, 75%, 55%)',
  'hsl(190, 80%, 42%)',
  'hsl(50, 90%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(10, 80%, 55%)',
  'hsl(120, 50%, 45%)',
  'hsl(215, 70%, 55%)',
];

function getCategoryColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function CategoryChart({
  expenses,
  categories,
  currency = 'EUR',
  selectedCategory,
  onCategorySelect,
  categoryLimits = {},
  onSetCategoryLimit,
}: CategoryChartProps) {
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((exp) => {
      map[exp.category] = (map[exp.category] || 0) + exp.amountCents;
    });
    return map;
  }, [expenses]);

  const { chartData, totalCents, largestSlice } = useMemo(() => {
    const totals: Record<Category, number> = {};
    expenses.forEach((expense) => {
      totals[expense.category] = (totals[expense.category] || 0) + expense.amountCents;
    });
    const data = categories
      .map((cat, index) => ({
        name: cat.label,
        value: totals[cat.value] || 0,
        category: cat.value,
        color: getCategoryColor(index),
      }))
      .filter((item) => item.value > 0);
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const largest = data.length ? data.reduce((a, b) => (a.value >= b.value ? a : b)) : null;
    return { chartData: data, totalCents: total, largestSlice: largest };
  }, [expenses, categories]);

  if (chartData.length === 0) {
    return (
      <div className="card-elevated p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-bold">Spending by Category</h3>
        </div>
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          No expenses yet — add one to see the breakdown
        </div>
        <CategoryBudgetList
          categories={categories}
          spentByCategory={spentByCategory}
          categoryLimits={categoryLimits}
          onSetCategoryLimit={onSetCategoryLimit}
          selectedCategory={selectedCategory}
          onCategorySelect={onCategorySelect}
          getColor={getCategoryColor}
        />
      </div>
    );
  }

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)', opacity: 0.15 }}>
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-bold">Spending by Category</h3>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
              {chartData.map((entry) => (
                <Cell key={entry.category} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length && totalCents > 0) {
                  const data = payload[0].payload;
                  const pct = Math.round((data.value / totalCents) * 100);
                  return (
                    <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3" style={{ boxShadow: 'var(--shadow-lg)' }}>
                      <p className="font-semibold text-foreground">{data.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">{formatMoney(data.value, currency)}</p>
                      <p className="text-xs text-muted-foreground">{pct}% of total</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 min-h-[36px]" role="list" aria-label="Category legend">
        {chartData.map((entry) => {
          const isSelected = selectedCategory === entry.category;
          return (
            <button
              key={entry.category}
              type="button"
              onClick={() => onCategorySelect(isSelected ? null : entry.category)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-opacity focus:outline-none focus:ring-2 focus:ring-ring ${isSelected ? 'ring-2 ring-primary opacity-100' : 'opacity-80 hover:opacity-100'}`}
              role="listitem"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} aria-hidden />
              <span className="text-foreground">{entry.name}</span>
            </button>
          );
        })}
      </div>
      {largestSlice && (
        <p className="mt-3 text-sm text-muted-foreground text-center">
          Biggest spending: <span className="font-semibold text-foreground">{largestSlice.name}</span> ({formatMoney(largestSlice.value, currency)})
        </p>
      )}

      {/* Planned vs Actual — category budgets with progress bars */}
      <CategoryBudgetList
        categories={categories}
        spentByCategory={spentByCategory}
        categoryLimits={categoryLimits}
        currency={currency}
        onSetCategoryLimit={onSetCategoryLimit}
        selectedCategory={selectedCategory}
        onCategorySelect={onCategorySelect}
        getColor={getCategoryColor}
      />
    </div>
  );
}

interface CategoryBudgetListProps {
  categories: CategoryDef[];
  spentByCategory: Record<string, number>;
  categoryLimits: Record<string, number>;
  currency?: string;
  onSetCategoryLimit?: (categoryValue: string, limitCents: number) => void;
  selectedCategory: Category | null;
  onCategorySelect: (category: Category | null) => void;
  getColor: (index: number) => string;
}

function CategoryBudgetList({
  categories,
  spentByCategory,
  categoryLimits,
  currency = 'EUR',
  onSetCategoryLimit,
  selectedCategory,
  onCategorySelect,
  getColor,
}: CategoryBudgetListProps) {
  return (
    <div className="mt-6 pt-5 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">Planned vs Actual</h4>
      </div>
      <ul className="space-y-3" role="list">
        {categories.map((cat, index) => {
          const spent = spentByCategory[cat.value] || 0;
          const limitCents = categoryLimits[cat.value];
          const hasLimit = limitCents != null && limitCents > 0;
          const remaining = hasLimit ? Math.max(0, limitCents - spent) : null;
          const overBy = hasLimit && spent > limitCents ? spent - limitCents : 0;
          const pct = hasLimit && limitCents > 0 ? Math.min(100, Math.round((spent / limitCents) * 100)) : 0;
          const isOver = hasLimit && spent > limitCents;
          const isSelected = selectedCategory === cat.value;

          return (
            <li
              key={cat.value}
              className={cn(
                'rounded-xl p-3 transition-colors',
                isSelected ? 'ring-2 ring-primary/50 bg-primary/5' : 'bg-muted/50 hover:bg-muted/70',
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <button
                  type="button"
                  onClick={() => onCategorySelect(isSelected ? null : cat.value)}
                  className="flex items-center gap-2 min-w-0 text-left"
                >
                  {(() => {
                    const Icon = getCategoryIcon(cat.iconKey);
                    return <Icon className="w-4 h-4 text-muted-foreground shrink-0" />;
                  })()}
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: getColor(index) }}
                    aria-hidden
                  />
                  <span className="font-medium text-sm truncate">{cat.label}</span>
                </button>
                {hasLimit ? (
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="text-muted-foreground">
                      Limit {formatMoney(limitCents, currency)}
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      Spent {formatMoney(spent, currency)}
                    </span>
                    {remaining !== null && (
                      <span className={cn('font-mono font-semibold', isOver ? 'text-destructive' : 'text-muted-foreground')}>
                        {isOver ? `Over by ${formatMoney(overBy, currency)}` : `Remaining ${formatMoney(remaining, currency)}`}
                      </span>
                    )}
                    {onSetCategoryLimit && (
                      <SetLimitPopover
                        categoryLabel={cat.label}
                        currency={currency}
                        currentLimitCents={limitCents}
                        onSave={(cents) => onSetCategoryLimit(cat.value, cents)}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="font-mono text-muted-foreground">
                      Spent {formatMoney(spent, currency)}
                    </span>
                    {onSetCategoryLimit && (
                      <SetLimitPopover
                        categoryLabel={cat.label}
                        currency={currency}
                        currentLimitCents={0}
                        onSave={(cents) => onSetCategoryLimit(cat.value, cents)}
                      />
                    )}
                  </div>
                )}
              </div>
              {hasLimit && (
                <div className="flex items-center gap-2">
                  <div className="progress-track flex-1 h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: isOver ? 'hsl(var(--destructive))' : 'var(--gradient-primary)',
                      }}
                    />
                  </div>
                  <span className={cn('text-xs font-mono shrink-0 w-8', isOver ? 'text-destructive' : 'text-muted-foreground')}>
                    {pct}%
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SetLimitPopover({
  categoryLabel,
  currency = 'EUR',
  currentLimitCents,
  onSave,
}: {
  categoryLabel: string;
  currency?: string;
  currentLimitCents: number;
  onSave: (limitCents: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(currentLimitCents > 0 ? String(centsToEuros(currentLimitCents)) : '');

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) setInputValue(currentLimitCents > 0 ? String(centsToEuros(currentLimitCents)) : '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const euros = parseFloat(inputValue.replace(',', '.'));
    if (!isNaN(euros) && euros >= 0) {
      onSave(eurosToCents(euros));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {currentLimitCents > 0 ? 'Edit' : 'Set limit'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm font-medium text-foreground">{categoryLabel} — monthly limit</p>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="e.g. 600"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="font-mono"
            />
            <span className="self-center text-sm text-muted-foreground">{getCurrencySymbol(currency)}</span>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1">
              Save
            </Button>
            {currentLimitCents > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onSave(0);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
