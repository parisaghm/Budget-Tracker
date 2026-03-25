import { useState } from 'react';
import { Trash2, Pencil, X, Check, Filter, ReceiptText } from 'lucide-react';
import { Expense, Category, CategoryDef, getCategoryLabel, DEFAULT_CATEGORIES } from '@/types/finance';
import { formatMoney, formatDate, eurosToCents, centsToEuros } from '@/utils/money';

interface ExpenseListProps {
  expenses: Expense[];
  categories: CategoryDef[];
  currency?: string;
  /** When provided (e.g. from chart legend click), filters the list and syncs the dropdown */
  categoryFilter?: Category | 'all';
  onCategoryFilterChange?: (category: Category | 'all') => void;
  onUpdate: (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
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
  categoryFilter: controlledFilter,
  onCategoryFilterChange,
  onUpdate,
  onDelete,
}: ExpenseListProps) {
  const [internalFilter, setInternalFilter] = useState<Category | 'all'>('all');
  const filterCategory = controlledFilter ?? internalFilter;
  const setFilterCategory = onCategoryFilterChange ?? setInternalFilter;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  const filteredExpenses = expenses
    .filter(exp => filterCategory === 'all' || exp.category === filterCategory)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditAmount(centsToEuros(expense.amountCents).toString());
    setEditNote(expense.note);
  };

  const saveEdit = (id: string) => {
    const value = parseFloat(editAmount);
    if (!isNaN(value) && value > 0) {
      onUpdate(id, { amountCents: eurosToCents(value), note: editNote.trim() });
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);
  const getCategoryClass = (category: Category): string => CATEGORY_CLASSES[category] || 'category-other';

  if (expenses.length === 0) {
    return (
      <div className="card-elevated p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
          <ReceiptText className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-bold text-lg mb-1">No expenses yet</h3>
        <p className="text-muted-foreground text-sm">Add your first expense to start tracking</p>
      </div>
    );
  }

  return (
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
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="divide-y divide-border">
        {filteredExpenses.map((expense) => (
          <div key={expense.id} className="expense-row animate-fade-in group">
            {editingId === expense.id ? (
              <div className="flex-1 flex items-center gap-3">
                <input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-28 px-3 py-2 rounded-xl border border-input bg-background text-sm font-mono font-bold" autoFocus />
                <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Note" className="flex-1 px-3 py-2 rounded-xl border border-input bg-background text-sm" />
                <button onClick={() => saveEdit(expense.id)} className="btn-icon text-success hover:bg-success/10"><Check className="w-4 h-4" /></button>
                <button onClick={cancelEdit} className="btn-icon text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-0.5">
                    <span className={`category-badge ${getCategoryClass(expense.category)}`}>
                      {getCategoryLabel(expense.category, categories.filter(c => !DEFAULT_CATEGORIES.some(d => d.value === c.value)))}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">{formatDate(expense.date)}</span>
                  </div>
                  {expense.note && (
                    <p className="text-sm text-muted-foreground truncate max-w-full">
                      {expense.note}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                  <span className="font-bold money-display text-base sm:text-lg">
                    {formatMoney(expense.amountCents, currency)}
                  </span>
                  <button onClick={() => startEdit(expense)} className="btn-icon opacity-0 group-hover:opacity-100 transition-opacity"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => onDelete(expense.id)} className="btn-icon text-destructive/60 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {filteredExpenses.length === 0 && expenses.length > 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">No expenses in this category</div>
      )}
    </div>
  );
}
