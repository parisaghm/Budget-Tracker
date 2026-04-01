import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Category, CategoryDef, Expense } from '@/types/finance';
import { eurosToCents, centsToEuros, getCurrencySymbol } from '@/utils/money';
import { getCategoryIcon } from '@/utils/categoryIcons';

function lastDayOfMonthYm(monthYm: string): string {
  const [y, m] = monthYm.split('-').map(Number);
  const last = new Date(y, m, 0);
  const day = String(last.getDate()).padStart(2, '0');
  return `${monthYm.slice(0, 7)}-${day}`;
}

interface EditExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  categories: CategoryDef[];
  currency?: string;
  /** YYYY-MM — edited date must stay in this month (dashboard month) */
  monthScope: string;
  onSave: (
    id: string,
    updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'budgetMonthId' | 'month'>>,
  ) => Promise<void>;
}

export function EditExpenseModal({
  open,
  onOpenChange,
  expense,
  categories,
  currency = 'EUR',
  monthScope,
  onSave,
}: EditExpenseModalProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('groceries');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !expense) return;
    setAmount(centsToEuros(expense.amountCents).toString());
    setCategory(expense.category);
    setDate(expense.date);
    setNote(expense.note);
  }, [open, expense]);

  const handleSave = async () => {
    if (!expense) return;
    const value = parseFloat(amount.replace(',', '.'));
    if (Number.isNaN(value) || value <= 0) {
      toast.error('Invalid amount', { description: 'Enter a positive amount.' });
      return;
    }
    if (!date.trim()) {
      toast.error('Date required');
      return;
    }
    if (date.slice(0, 7) !== monthScope) {
      toast.error('Invalid date', { description: `Date must be within ${monthScope}.` });
      return;
    }
    const allowed = new Set(categories.map((c) => c.value));
    if (!allowed.has(category)) {
      toast.error('Invalid category');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(expense.id, {
        amountCents: eurosToCents(value),
        category,
        date,
        note: note.trim(),
      });
      toast.success('Expense updated');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update expense';
      toast.error('Update failed', { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  const minDate = `${monthScope}-01`;
  const maxDate = lastDayOfMonthYm(monthScope);

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:rounded-xl border-border">
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
          <DialogDescription>
            Update amount, category, date, or note. Changes apply immediately.
          </DialogDescription>
        </DialogHeader>

        {expense && (
          <div className="space-y-4 py-1">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xl min-w-[1.25rem]">
                  {getCurrencySymbol(currency)}
                </span>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-clean pl-12 text-2xl font-mono font-bold h-14 w-full"
                  disabled={isSaving}
                  autoComplete="off"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    disabled={isSaving}
                    onClick={() => setCategory(cat.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
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
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">
                Date
              </label>
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-clean w-full"
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">
                Note (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What was this for?"
                className="input-clean w-full"
                disabled={isSaving}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <button
            type="button"
            className="btn-primary gap-2 min-w-[7rem] inline-flex items-center justify-center"
            onClick={() => void handleSave()}
            disabled={isSaving || !expense}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
