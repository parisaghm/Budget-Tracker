import { useState } from 'react';
import { Trash2, PencilLine, Filter, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { Expense, Category, CategoryDef, getCategoryLabel, DEFAULT_CATEGORIES } from '@/types/finance';
import { formatMoney, formatDate } from '@/utils/money';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { CategoryEmojiIcon } from '@/components/icons/CategoryEmojiIcon';
import { Button } from '@/components/ui/button';

interface ExpenseListProps {
  expenses: Expense[];
  categories: CategoryDef[];
  currency?: string;
  /** Dashboard month (YYYY-MM); edited expense dates must stay in this month */
  monthScope: string;
  categoryFilter?: Category | 'all';
  onCategoryFilterChange?: (category: Category | 'all') => void;
  onUpdate: (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'budgetMonthId' | 'month'>>) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

const CATEGORY_CLASSES: Record<string, string> = {
  groceries: 'category-groceries',
  shopping: 'category-shopping',
  entertainment: 'category-entertainment',
  other: 'category-other',
};

export function ExpenseList({
  expenses,
  categories,
  currency = 'EUR',
  monthScope,
  categoryFilter: controlledFilter,
  onCategoryFilterChange,
  onUpdate,
  onDelete,
}: ExpenseListProps) {
  const [internalFilter, setInternalFilter] = useState<Category | 'all'>('all');
  const filterCategory = controlledFilter ?? internalFilter;
  const setFilterCategory = onCategoryFilterChange ?? setInternalFilter;

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredExpenses = expenses
    .filter((exp) => filterCategory === 'all' || exp.category === filterCategory)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const customCatsOnly = categories.filter((c) => !DEFAULT_CATEGORIES.some((d) => d.value === c.value));

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await Promise.resolve(onDelete(deleteTarget.id));
      toast.success('Expense deleted');
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete expense';
      toast.error('Delete failed', { description: message });
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryClass = (category: Category): string => CATEGORY_CLASSES[category] || 'category-other';

  if (expenses.length === 0) {
    return (
      <div className="card-elevated p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
          <ReceiptText className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-bold text-lg mb-1">Start tracking your spending</h3>
        <p className="text-muted-foreground text-sm mb-4">Add your first expense to begin understanding where your money goes.</p>
        <p className="inline-flex items-center rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          Add expense
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card-elevated overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold text-base sm:text-lg">Recent Expenses</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as Category | 'all')}
              className="text-sm bg-secondary border-0 rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring/20 font-medium max-w-[180px] sm:max-w-none"
            >
              <option value="all">All categories</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="divide-y divide-border">
          {filteredExpenses.map((expense) => (
            <div key={expense.id} className="expense-row animate-fade-in group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-0.5">
                  <CategoryEmojiIcon
                    categoryValue={expense.category}
                    iconKey={categories.find((c) => c.value === expense.category)?.iconKey}
                    label={getCategoryLabel(expense.category, customCatsOnly)}
                    decorative
                    className="h-7 w-7"
                    iconClassName="h-4 w-4"
                  />
                  <span className={`category-badge ${getCategoryClass(expense.category)}`}>
                    {getCategoryLabel(expense.category, customCatsOnly)}
                  </span>
                  <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">{formatDate(expense.date)}</span>
                </div>
                {expense.note && (
                  <p className="text-sm text-muted-foreground truncate max-w-full">{expense.note}</p>
                )}
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-2 w-full sm:w-auto mt-1 sm:mt-0 shrink-0">
                <span className="font-bold money-display text-base sm:text-lg">{formatMoney(expense.amountCents, currency)}</span>
                <div className="flex items-center gap-1 sm:gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditingExpense(expense)}
                    className="btn-icon min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
                    aria-label="Edit expense"
                  >
                    <PencilLine className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(expense)}
                    className="btn-icon min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-destructive/60 hover:text-destructive hover:bg-destructive/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
                    aria-label="Delete expense"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredExpenses.length === 0 && expenses.length > 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No expenses in this category</div>
        )}
      </div>

      <EditExpenseModal
        key={editingExpense?.id ?? 'none'}
        open={editingExpense !== null}
        onOpenChange={(open) => !open && setEditingExpense(null)}
        expense={editingExpense}
        categories={categories}
        currency={currency}
        monthScope={monthScope}
        onSave={onUpdate}
      />

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
        title="Delete expense?"
        description="This removes the expense permanently. This action cannot be undone."
        detail={
          deleteTarget ? (
            <>
              {formatMoney(deleteTarget.amountCents, currency)}
              {deleteTarget.note ? ` · ${deleteTarget.note}` : ''}
            </>
          ) : undefined
        }
        onConfirm={handleDeleteConfirm}
        isConfirming={isDeleting}
      />
    </>
  );
}
