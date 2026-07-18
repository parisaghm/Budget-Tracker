import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { flushSync } from 'react-dom';
import { Wallet, Check, Pencil } from 'lucide-react';
import { eurosToCents, centsToEuros, formatMoney, getCurrencySymbol } from '@/utils/money';

export type SalarySetupHandle = {
  openEdit: () => void;
};

interface SalarySetupProps {
  /** Total income already saved for this cycle (sum of entries). Not used to prefill the input. */
  currentSalaryCents: number | null;
  incomeNote?: string | null;
  /** Previous cycle total — reference only; never prefills or saves. */
  previousCycleIncomeCents?: number | null;
  /** ISO 4217 code for display and salary input prefix */
  currency?: string;
  onSave: (salaryCents: number, incomeNote?: string) => void;
  /** When true, omit outer card chrome for use inside BudgetSummary. */
  embedded?: boolean;
}

export const SalarySetup = forwardRef<SalarySetupHandle, SalarySetupProps>(function SalarySetup(
  {
    currentSalaryCents,
    incomeNote,
    previousCycleIncomeCents = null,
    currency = 'EUR',
    onSave,
    embedded = false,
  },
  ref,
) {
  const hasSavedIncome = (currentSalaryCents ?? 0) > 0;
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isEditing, setIsEditing] = useState(!hasSavedIncome);

  useEffect(() => {
    if (!isEditing) {
      setNote(incomeNote || '');
    }
  }, [incomeNote, isEditing]);

  const handleSave = () => {
    const value = parseFloat(amount);
    if (!isNaN(value) && value > 0) {
      onSave(eurosToCents(value), note.trim() || undefined);
      setAmount('');
      setNote('');
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
        setAmount('');
        setNote('');
      });
      document.getElementById('salary-setup-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  }), []);

  if (!isEditing && hasSavedIncome && currentSalaryCents) {
    return (
      <button
        id="salary-setup-section"
        type="button"
        onClick={() => {
          setIsEditing(true);
          setAmount('');
          setNote('');
        }}
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
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Income this cycle</p>
          <p className="text-2xl font-bold money-display mt-0.5">
            {formatMoney(currentSalaryCents, currency)}
          </p>
          {incomeNote && (
            <p className="text-xs text-muted-foreground mt-1">
              {incomeNote}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Tap to add another income entry</p>
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
          ? 'flex animate-scale-in items-start gap-3 sm:gap-4'
          : 'flex animate-scale-in items-start gap-4 rounded-2xl border border-border bg-card p-5'
      }
      style={embedded ? undefined : { boxShadow: 'var(--shadow-md)' }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--gradient-accent)' }}>
        <Wallet className="w-5 h-5 text-accent-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {(previousCycleIncomeCents ?? 0) > 0 ? (
          <p className="mb-2 text-xs text-muted-foreground">
            Previous cycle income:{' '}
            <span className="font-medium text-foreground">
              {formatMoney(previousCycleIncomeCents!, currency)}
            </span>
            <span className="ml-1">(reference only)</span>
          </p>
        ) : null}
        <div className="flex items-end gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Income this cycle
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
          </div>
          <button
            onClick={handleSave}
            disabled={!amount || parseFloat(amount) <= 0}
            className="btn-primary h-12 w-12 shrink-0 p-0"
            aria-label="Save income"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mt-3 mb-1.5">
          Note (optional)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Salary, freelance, bonus"
          className="input-clean h-9 text-sm"
        />
      </div>
    </div>
  );
});
