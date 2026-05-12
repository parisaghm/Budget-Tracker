import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Category, CategoryDef, Expense } from '@/types/finance';
import {
  centsToEuros,
  eurosToCents,
  getCurrencySymbol,
  normalizeYearMonthYm,
  toDateInputValue,
} from '@/utils/money';
import { getCategoryIcon } from '@/utils/categoryIcons';

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmdToLocalDate(ymd: string): Date | undefined {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(y, mo - 1, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== day) return undefined;
  return dt;
}

interface EditExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  categories: CategoryDef[];
  currency?: string;
  /** YYYY-MM for the list you're editing from — used as a fallback if the expense has no valid date */
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const formSyncKeyRef = useRef<string | null>(null);

  const scopeYm = normalizeYearMonthYm(monthScope);

  const scopedMonthStart = useMemo(() => {
    const [sy, sm] = scopeYm.split('-').map(Number);
    return new Date(sy, sm - 1, 1);
  }, [scopeYm]);

  const selectedCalendarDate = useMemo(() => parseYmdToLocalDate(date), [date]);

  useEffect(() => {
    if (!open) {
      formSyncKeyRef.current = null;
      setDatePickerOpen(false);
      return;
    }
    if (!expense) return;

    const syncKey = `${expense.id}|${scopeYm}`;
    if (formSyncKeyRef.current === syncKey) {
      return;
    }
    formSyncKeyRef.current = syncKey;

    setAmount(centsToEuros(expense.amountCents).toString());
    setCategory(expense.category);
    const normalized = toDateInputValue(expense.date);
    setDate(normalized || `${scopeYm}-01`);
    setNote(expense.note);
  }, [open, expense, scopeYm]);

  const handleSave = async () => {
    if (!expense) return;
    const rawAmount = amount.replace(/\s/g, '').replace(',', '.');
    const value = Number.parseFloat(rawAmount);
    if (Number.isNaN(value) || value <= 0) {
      toast.error('Invalid amount', { description: 'Enter a positive amount.' });
      return;
    }
    let dateToSave = toDateInputValue(date);
    if (!dateToSave) {
      dateToSave = toDateInputValue(expense.date);
    }
    if (!dateToSave) {
      toast.error('Invalid date', { description: 'Choose a valid calendar day.' });
      return;
    }
    const allowed = new Set(categories.map((c) => c.value));
    if (expense.category) allowed.add(expense.category);
    if (!allowed.has(category)) {
      toast.error('Invalid category', { description: 'Pick a category from the list.' });
      return;
    }

    const baselineYmd = toDateInputValue(expense.date) || `${scopeYm}-01`;
    const updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'budgetMonthId' | 'month'>> = {
      amountCents: eurosToCents(value),
      category,
      note: note.trim(),
    };
    if (dateToSave !== baselineYmd) {
      updates.date = dateToSave;
    }

    setIsSaving(true);
    try {
      await onSave(expense.id, updates);
      toast.success('Expense updated');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update expense';
      toast.error('Update failed', { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:rounded-xl border-border">
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
          <DialogDescription>
            Update amount, category, date, or note. Choosing a date in another month moves this expense to that
            month after you save.
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
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen} modal={false}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={isSaving}
                    className={cn(
                      'input-clean w-full flex items-center justify-between gap-2 text-left font-normal min-h-[2.75rem]',
                      !date && 'text-muted-foreground',
                    )}
                  >
                    <span>
                      {selectedCalendarDate
                        ? selectedCalendarDate.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })
                        : 'Pick a day'}
                    </span>
                    <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedCalendarDate}
                    onSelect={(d) => {
                      if (!d) return;
                      setDate(localYmd(d));
                      setDatePickerOpen(false);
                    }}
                    defaultMonth={selectedCalendarDate ?? scopedMonthStart}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
