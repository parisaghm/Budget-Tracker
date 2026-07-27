import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Receipt, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Category, CategoryDef, Expense } from '@/types/finance';
import {
  centsToEuros,
  defaultExpenseDateForBudgetMonth,
  eurosToCents,
  formatMoney,
  getCurrencySymbol,
  getTodayDate,
} from '@/utils/money';
import { ICON_MAP, inferIconKeyFromLabel } from '@/utils/categoryIcons';
import { CategoryEmojiIcon } from '@/components/icons/CategoryEmojiIcon';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';

type DeleteCategoryResult = { success: true } | { success: false; error: string };

interface ExpenseFormProps {
  currency?: string;
  /** YYYY-MM of the month being viewed — new expenses default to a day in this month */
  budgetMonth?: string;
  onAdd: (expense: { amountCents: number; category: Category; date: string; note: string }) => void | Promise<void>;
  categories: CategoryDef[];
  expenses: Expense[];
  onAddCategory: (
    label: string,
    iconKey?: string,
  ) => void | Promise<{ success: true } | { success: false; error: string }>;
  onDeleteCategory?: (categoryValue: string) => DeleteCategoryResult;
}

interface FavoriteExpense {
  id: string;
  title: string;
  amountCents: number;
  category: Category;
  createdAt: string;
  useCount: number;
  lastUsedAt: string;
}

const FAVORITES_STORAGE_KEY = 'bt_expense_favorites_v1';
const MAX_RECENT_CATEGORIES = 4;

function readFavorites(): FavoriteExpense[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ExpenseForm({
  currency = 'EUR',
  budgetMonth,
  onAdd,
  categories,
  expenses,
  onAddCategory,
  onDeleteCategory,
}: ExpenseFormProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>(categories[0]?.value || 'groceries');
  const [date, setDate] = useState(() =>
    budgetMonth?.trim() ? defaultExpenseDateForBudgetMonth(budgetMonth) : getTodayDate(),
  );
  const [note, setNote] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedIconKey, setSelectedIconKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteExpense[]>(readFavorites);
  const [categoryDeleteTarget, setCategoryDeleteTarget] = useState<CategoryDef | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const ym = budgetMonth?.trim();
    if (!ym) return;
    setDate(defaultExpenseDateForBudgetMonth(ym));
  }, [budgetMonth]);

  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [expenses],
  );
  const lastExpense = sortedExpenses[0] ?? null;

  const categoryByValue = useMemo(
    () => new Map(categories.map((cat) => [cat.value, cat])),
    [categories],
  );

  const recentCategories = useMemo(() => {
    if (sortedExpenses.length === 0) return categories.slice(0, MAX_RECENT_CATEGORIES);
    const scores = new Map<Category, number>();
    sortedExpenses.slice(0, 100).forEach((exp, idx) => {
      const recencyScore = Math.max(1, 100 - idx);
      scores.set(exp.category, (scores.get(exp.category) || 0) + recencyScore);
    });
    return [...categories]
      .sort((a, b) => (scores.get(b.value) || 0) - (scores.get(a.value) || 0))
      .slice(0, MAX_RECENT_CATEGORIES);
  }, [categories, sortedExpenses]);

  const topFavoriteExpenses = useMemo(
    () =>
      [...favorites]
        .sort((a, b) => {
          if (b.useCount !== a.useCount) return b.useCount - a.useCount;
          return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
        })
        .slice(0, 4),
    [favorites],
  );

  const smartSuggestions = useMemo(() => {
    const search = note.trim().toLowerCase();
    if (!search) return { byMerchant: [] as Expense[], amountHints: [] as number[] };
    const seen = new Set<string>();
    const byMerchant = sortedExpenses
      .filter((exp) => exp.note.trim().length > 0 && exp.note.toLowerCase().includes(search))
      .slice(0, 6)
      .map((exp) => {
        const key = `${exp.note.toLowerCase()}-${exp.category}-${exp.amountCents}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return exp;
      })
      .filter((exp): exp is Expense => exp !== null);

    const frequentAmounts = sortedExpenses
      .slice(0, 40)
      .reduce<Record<number, number>>((acc, exp) => {
        acc[exp.amountCents] = (acc[exp.amountCents] || 0) + 1;
        return acc;
      }, {});

    const amountHints = Object.entries(frequentAmounts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 3)
      .map(([amountCents]) => Number(amountCents));

    return { byMerchant, amountHints };
  }, [note, sortedExpenses]);

  const applyDraft = (draft: { amountCents?: number; category?: Category; title?: string }) => {
    if (draft.amountCents && draft.amountCents > 0) setAmount(centsToEuros(draft.amountCents).toFixed(2));
    if (draft.category) setCategory(draft.category);
    if (draft.title !== undefined) setNote(draft.title);
    setCategoryError(null);
  };

  const upsertFavorite = (draft: { title: string; amountCents: number; category: Category }) => {
    const normalized = draft.title.trim().toLowerCase();
    if (!normalized || draft.amountCents <= 0) return;
    setFavorites((prev) => {
      const existing = prev.find(
        (fav) =>
          fav.title.trim().toLowerCase() === normalized &&
          fav.amountCents === draft.amountCents &&
          fav.category === draft.category,
      );
      if (existing) {
        return prev.map((fav) =>
          fav.id === existing.id
            ? { ...fav, useCount: fav.useCount + 1, lastUsedAt: new Date().toISOString() }
            : fav,
        );
      }
      return [
        {
          id: crypto.randomUUID(),
          title: draft.title.trim(),
          amountCents: draft.amountCents,
          category: draft.category,
          createdAt: new Date().toISOString(),
          useCount: 1,
          lastUsedAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!isNaN(value) && value > 0) {
      const draft = { title: note.trim(), amountCents: eurosToCents(value), category };
      setIsSaving(true);
      try {
        await Promise.resolve(
          onAdd({ amountCents: draft.amountCents, category: draft.category, date, note: draft.title }),
        );
        if (saveAsFavorite) {
          upsertFavorite(draft);
          setSaveAsFavorite(false);
        }
        setAmount('');
        setNote('');
        setDate(budgetMonth?.trim() ? defaultExpenseDateForBudgetMonth(budgetMonth) : getTodayDate());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save expense';
        toast.error('Expense not saved', { description: message });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleAddCategory = async () => {
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
    const iconArg =
      (selectedIconKey && selectedIconKey in ICON_MAP ? selectedIconKey : undefined) ?? fallbackIconKey;
    const result = await Promise.resolve(onAddCategory(label, iconArg));
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      setCategoryError(result.error);
      return;
    }
    const value = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setCategory(value);
    setNewCategoryLabel('');
    setIsAddingCategory(false);
  };

  const handleDeleteCategoryClick = (e: React.MouseEvent, cat: CategoryDef) => {
    e.stopPropagation();
    if (!onDeleteCategory || !cat.isCustom) return;
    setCategoryDeleteTarget(cat);
  };

  const handleDeleteCategoryConfirm = () => {
    if (!categoryDeleteTarget || !onDeleteCategory) return;
    const cat = categoryDeleteTarget;
    const result = onDeleteCategory(cat.value);
    if (result.success) {
      if (category === cat.value) setCategory('groceries');
      setCategoryDeleteTarget(null);
    } else {
      setCategoryError(result.error);
      setCategoryDeleteTarget(null);
    }
  };

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="card-elevated animate-slide-up rounded-3xl p-4 sm:rounded-2xl sm:p-6"
    >
      <div className="mb-5 flex items-center gap-3 sm:mb-6">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl sm:h-11 sm:w-11 sm:rounded-xl"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <Receipt className="h-6 w-6 text-primary-foreground sm:h-5 sm:w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold sm:text-lg">Add expense</h2>
          <p className="text-sm text-muted-foreground sm:text-xs">Full details when you need them</p>
        </div>
      </div>

      <div className="space-y-5">
        {topFavoriteExpenses.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
              <Star className="w-3.5 h-3.5" />
              Favorites
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {topFavoriteExpenses.map((fav) => (
                <button
                  key={fav.id}
                  type="button"
                  onClick={() => applyDraft({ amountCents: fav.amountCents, category: fav.category, title: fav.title })}
                  className="rounded-xl border border-border bg-secondary/60 hover:bg-secondary transition-colors px-3 py-3 text-left min-h-[56px]"
                >
                  <p className="text-sm font-semibold">{fav.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(fav.amountCents, currency)} · {categoryByValue.get(fav.category)?.label ?? fav.category}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">Amount</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-2xl min-w-[1.5rem]">
              {getCurrencySymbol(currency)}
            </span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input-clean h-[4.25rem] min-h-[4.25rem] pl-14 font-mono text-3xl font-bold tabular-nums"
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
          <div className="grid grid-cols-2 gap-2.5 sm:gap-2">
            {categories.map((cat) => (
              <div key={cat.value} className="group relative">
                <button
                  type="button"
                  onClick={() => { setCategory(cat.value); setCategoryError(null); }}
                  className={`flex min-h-[3.25rem] w-full touch-manipulation items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold transition-all duration-200 sm:min-h-[52px] sm:rounded-xl sm:px-4 ${
                    category === cat.value
                      ? 'text-primary-foreground shadow-md sm:-translate-y-0.5'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
                  }`}
                  style={category === cat.value ? { background: 'var(--gradient-primary)' } : undefined}
                >
                  <CategoryEmojiIcon
                    categoryValue={cat.value}
                    iconKey={cat.iconKey}
                    label={cat.label}
                    decorative
                    className="h-7 w-7"
                    iconClassName="h-4 w-4"
                  />
                  <span className="truncate">{cat.label}</span>
                </button>
                {cat.isCustom && onDeleteCategory && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCategoryClick(e, cat)}
                    aria-label="Delete category"
                    className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg bg-background/40 text-muted-foreground opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
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
                  {Object.entries(ICON_MAP).map(([key, src]) => {
                    const inferredKey = inferIconKeyFromLabel(newCategoryLabel || '');
                    const isActive = (selectedIconKey || inferredKey) === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedIconKey(key)}
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                          isActive
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-secondary/60 hover:bg-secondary'
                        }`}
                        aria-label={key}
                      >
                        <img src={src} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" draggable={false} />
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

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">Title</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Coffee, Netflix, Lunch..."
            className="input-clean min-h-[52px] text-base"
          />
          {note.trim().length > 1 && smartSuggestions.byMerchant.length > 0 && (
            <div className="mt-2 space-y-1">
              {smartSuggestions.byMerchant.map((suggestion) => (
                <button
                  key={`${suggestion.id}-suggestion`}
                  type="button"
                  onClick={() =>
                    applyDraft({
                      title: suggestion.note,
                      amountCents: suggestion.amountCents,
                      category: suggestion.category,
                    })
                  }
                  className="w-full text-left rounded-lg px-3 py-2 bg-secondary/60 hover:bg-secondary transition-colors text-sm"
                >
                  {suggestion.note} — {categoryByValue.get(suggestion.category)?.label ?? suggestion.category} — {formatMoney(suggestion.amountCents, currency)}
                </button>
              ))}
            </div>
          )}
          {smartSuggestions.amountHints.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {smartSuggestions.amountHints.map((hint) => (
                <button
                  key={`amount-hint-${hint}`}
                  type="button"
                  onClick={() => setAmount(centsToEuros(hint).toFixed(2))}
                  className="text-xs px-3 py-1.5 rounded-lg bg-secondary/70 hover:bg-secondary"
                >
                  {formatMoney(hint, currency)}
                </button>
              ))}
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-clean" />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-muted-foreground hover:text-primary font-medium transition-colors"
        >
          {isExpanded ? '− Hide advanced options' : '+ More options'}
        </button>

        <button
          type="button"
          onClick={() => setSaveAsFavorite((prev) => !prev)}
          className={`w-full rounded-xl border px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            saveAsFavorite
              ? 'border-primary text-primary bg-primary/10'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          {saveAsFavorite ? <Check className="w-4 h-4" /> : <Star className="w-4 h-4" />}
          Save this expense as favorite
        </button>

        <div className="pt-2">
          <button
            type="submit"
            disabled={!amount || parseFloat(amount) <= 0 || isSaving}
            className="btn-primary h-14 w-full gap-2 text-base shadow-xl touch-manipulation"
          >
            <Plus className="w-5 h-5" />
            {isSaving ? 'Saving…' : 'Add Expense'}
          </button>
        </div>
      </div>
    </form>
    <DeleteConfirmDialog
      open={categoryDeleteTarget !== null}
      onOpenChange={(open) => !open && setCategoryDeleteTarget(null)}
      title="Delete category?"
      description="This removes the custom category permanently. Expenses using it will need another category."
      detail={categoryDeleteTarget?.label}
      onConfirm={handleDeleteCategoryConfirm}
      confirmLabel="Delete"
      confirmingLabel="Deleting…"
    />
    </>
  );
}
