import { forwardRef, useImperativeHandle, useState } from 'react';
import { flushSync } from 'react-dom';
import { Wallet, Check, Pencil } from 'lucide-react';
import { eurosToCents, centsToEuros, formatMoney, getCurrencySymbol } from '@/utils/money';

export type SalarySetupHandle = {
  openEdit: () => void;
};

interface SalarySetupProps {
  currentSalaryCents: number | null;
  incomeNote?: string | null;
  /** ISO 4217 code for display and salary input prefix */
  currency?: string;
  onSave: (salaryCents: number, incomeNote?: string) => void;
  /** When true, omit outer card chrome for use inside BudgetSummary. */
  embedded?: boolean;
}

export const SalarySetup = forwardRef<SalarySetupHandle, SalarySetupProps>(function SalarySetup(
  { currentSalaryCents, incomeNote, currency = 'EUR', onSave, embedded = false },
  ref,
) {
  const [amount, setAmount] = useState(
    currentSalaryCents ? centsToEuros(currentSalaryCents).toString() : ''
  );
  const [note, setNote] = useState(incomeNote || '');
  const [isEditing, setIsEditing] = useState(!currentSalaryCents);

  const handleSave = () => {
    const value = parseFloat(amount);
    if (!isNaN(value) && value > 0) {
      onSave(eurosToCents(value), note.trim() || undefined);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
  };

  useImperativeHandle(ref, () => ({
    openEdit: () => {
      flushSync(() => {
        setIsEditing(true);
        if (currentSalaryCents != null) {
          setAmount(centsToEuros(currentSalaryCents).toString());
        }
        setNote(incomeNote || '');
      });
      document.getElementById('salary-setup-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  }), [currentSalaryCents, incomeNote]);

  if (!isEditing && currentSalaryCents) {
    return (
      <button
        id="salary-setup-section"
        type="button"
        onClick={() => setIsEditing(true)}
        className={
          embedded
            ? 'group flex w-full items-center gap-3 rounded-xl py-1 text-left transition-colors hover:bg-muted/40 sm:gap-4'
            : 'group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/30'
        }
        style={embedded ? undefined : { boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-accent)' }}>
          <Wallet className="w-5 h-5 text-accent-foreground" />
        </div>
        <div className="text-left flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Monthly Salary</p>
          <p className="text-2xl font-bold money-display mt-0.5">
            {formatMoney(currentSalaryCents, currency)}
          </p>
          {incomeNote && (
            <p className="text-xs text-muted-foreground mt-1">
              {incomeNote}
            </p>
          )}
        </div>
        <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div
      id="salary-setup-section"
      className={
        embedded
          ? 'flex animate-scale-in items-center gap-3 sm:gap-4'
          : 'flex animate-scale-in items-center gap-4 rounded-2xl border border-border bg-card p-5'
      }
      style={embedded ? undefined : { boxShadow: 'var(--shadow-md)' }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-accent)' }}>
        <Wallet className="w-5 h-5 text-accent-foreground" />
      </div>
      <div className="flex-1">
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
          Monthly Salary (Net)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-lg min-w-[1.25rem]">
            {getCurrencySymbol(currency)}
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0.00"
            className="input-clean pl-10 pr-4 font-mono text-lg h-12"
            autoFocus
          />
        </div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mt-3 mb-1.5">
          Income note (optional)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Bonus, raise, reduced hours"
          className="input-clean h-9 text-sm"
        />
      </div>
      <button onClick={handleSave} disabled={!amount || parseFloat(amount) <= 0} className="btn-primary h-12 w-12 p-0">
        <Check className="w-5 h-5" />
      </button>
    </div>
  );
});
