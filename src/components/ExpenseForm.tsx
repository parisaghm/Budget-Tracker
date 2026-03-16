import { useState } from 'react';
import { Plus, Receipt, X, Trash2 } from 'lucide-react';
import { Category, CategoryDef } from '@/types/finance';
import { eurosToCents, getTodayDate } from '@/utils/money';
import { getCategoryIcon, ICON_MAP, inferIconKeyFromLabel } from '@/utils/categoryIcons';

type DeleteCategoryResult = { success: true } | { success: false; error: string };

interface ExpenseFormProps {
  onAdd: (expense: { amountCents: number; category: Category; date: string; note: string }) => void;
  categories: CategoryDef[];
  onAddCategory: (label: string, iconKey?: string) => void;
  onDeleteCategory?: (categoryValue: string) => DeleteCategoryResult;
}

export function ExpenseForm({ onAdd, categories, onAddCategory, onDeleteCategory }: ExpenseFormProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>(categories[0]?.value || 'groceries');
  const [date, setDate] = useState(getTodayDate());
  const [note, setNote] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedIconKey, setSelectedIconKey] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!isNaN(value) && value > 0) {
      onAdd({ amountCents: eurosToCents(value), category, date, note: note.trim() });
      setAmount('');
      setNote('');
      setDate(getTodayDate());
    }
  };

  const handleAddCategory = () => {
    const label = newCategoryLabel.trim();
    if (!label) return;

    const lowerLabel = label.toLowerCase();
    const exists = categories.some(
      (cat) => cat.label.trim().toLowerCase() === lowerLabel,
    );

    if (exists) {
      setCategoryError('A category with this name already exists.');
      return;
    }

    setCategoryError(null);
    const fallbackIconKey = inferIconKeyFromLabel(label);
    onAddCategory(label, (selectedIconKey && selectedIconKey in ICON_MAP ? selectedIconKey : undefined) ?? fallbackIconKey);
    const value = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setCategory(value);
    setNewCategoryLabel('');
    setIsAddingCategory(false);
  };

  const handleDeleteCategory = (e: React.MouseEvent, cat: CategoryDef) => {
    e.stopPropagation();
    if (!onDeleteCategory || !cat.isCustom) return;
    if (!confirm(`Remove category "${cat.label}"?`)) return;
    const result = onDeleteCategory(cat.value);
    if (result.success) {
      if (category === cat.value) setCategory('groceries');
    } else {
      setCategoryError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-elevated p-6 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
          <Receipt className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-bold">New Expense</h2>
          <p className="text-xs text-muted-foreground">Track where your money goes</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Amount */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">Amount</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-2xl">€</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input-clean pl-14 text-3xl font-mono h-16 font-bold"
              required
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">Category</label>
          {categoryError && (
            <p className="text-xs text-destructive mb-1">{categoryError}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <div key={cat.value} className="relative group">
                <button
                  type="button"
                  onClick={() => { setCategory(cat.value); setCategoryError(null); }}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                    category === cat.value
                      ? 'text-primary-foreground shadow-md -translate-y-0.5'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
                  }`}
                  style={category === cat.value ? { background: 'var(--gradient-primary)' } : undefined}
                >
                  {(() => {
                    const Icon = getCategoryIcon(cat.iconKey);
                    return (
                      <span className="inline-flex items-center justify-center rounded-lg bg-background/10">
                        <Icon className="w-4 h-4" />
                      </span>
                    );
                  })()}
                  <span className="truncate">{cat.label}</span>
                </button>
                {cat.isCustom && onDeleteCategory && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCategory(e, cat)}
                    aria-label="Delete category"
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity bg-background/20 hover:bg-destructive/20 hover:text-destructive text-muted-foreground"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {isAddingCategory ? (
              <div className="col-span-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCategoryLabel}
                    onChange={(e) => {
                      setNewCategoryLabel(e.target.value);
                      setCategoryError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                    placeholder="Category name"
                    className="input-clean text-sm flex-1"
                    autoFocus
                  />
                  <button type="button" onClick={handleAddCategory} className="btn-primary h-11 px-4" disabled={!newCategoryLabel.trim()}>
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCategory(false);
                      setNewCategoryLabel('');
                      setSelectedIconKey(null);
                      setCategoryError(null);
                    }}
                    className="btn-icon"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Simple icon picker grid */}
                <div className="flex flex-wrap gap-1">
                  {Object.entries(ICON_MAP).map(([key, Icon]) => {
                    const inferredKey = inferIconKeyFromLabel(newCategoryLabel || '');
                    const isActive = (selectedIconKey || inferredKey) === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedIconKey(key)}
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                          isActive
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingCategory(true)}
                className="px-4 py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-all duration-200"
              >
                + Add Category
              </button>
            )}
          </div>
        </div>

        {/* Expandable */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-muted-foreground hover:text-primary font-medium transition-colors"
        >
          {isExpanded ? '− Less options' : '+ More options'}
        </button>

        {isExpanded && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-clean" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">Note (optional)</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was this for?" className="input-clean" />
            </div>
          </div>
        )}

        <button type="submit" disabled={!amount || parseFloat(amount) <= 0} className="btn-primary w-full h-14 text-base gap-2">
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>
    </form>
  );
}
