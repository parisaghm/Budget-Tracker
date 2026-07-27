import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { BudgetIconCell } from '@/components/budget/BudgetIconCell';
import type { IncomeEntry } from '@/types/budgetCycle';
import { inferIncomeIconKey } from '@/utils/categoryIcons';
import { eurosToCents, centsToEuros, formatMoney, getCurrencySymbol } from '@/utils/money';
import { cn } from '@/lib/utils';

export type IncomeFormMode = 'closed' | 'adding' | 'editing';

export type SalarySetupHandle = {
  /** Opens the panel in add mode (clears the form). */
  openEdit: () => void;
  /** Opens the panel in edit mode for a specific entry. */
  editEntry: (entry: IncomeEntry) => void;
};

interface SalarySetupProps {
  incomeEntries: IncomeEntry[];
  /** Previous cycle total — reference only; never prefills or saves. */
  previousCycleIncomeCents?: number | null;
  /** ISO 4217 code for display and salary input prefix */
  currency?: string;
  onSave: (salaryCents: number, incomeNote?: string) => void | Promise<void>;
  onUpdate: (entryId: string, salaryCents: number, incomeNote?: string) => void | Promise<void>;
  onDelete: (entryId: string) => void | Promise<void>;
  isSaving?: boolean;
  isDeleting?: boolean;
  /** When true, omit outer card chrome for use inside BudgetSummary. */
  embedded?: boolean;
  /** Called when the panel should collapse (e.g. after cancel with no income). */
  onRequestClose?: () => void;
}

function titleCaseSource(source: string): string {
  return source
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function incomeDisplayLabel(entry: IncomeEntry): string {
  const note = entry.note?.trim();
  if (note) return note;
  const source = entry.source?.trim();
  if (source) return titleCaseSource(source);
  return 'Income';
}

function amountToInputValue(cents: number): string {
  if (!Number.isFinite(cents)) return '';
  return centsToEuros(cents).toFixed(2);
}

export const SalarySetup = forwardRef<SalarySetupHandle, SalarySetupProps>(function SalarySetup(
  {
    incomeEntries,
    previousCycleIncomeCents = null,
    currency = 'EUR',
    onSave,
    onUpdate,
    onDelete,
    isSaving = false,
    isDeleting = false,
    embedded = false,
    onRequestClose,
  },
  ref,
) {
  const amountInputRef = useRef<HTMLInputElement>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<IncomeFormMode>('closed');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IncomeEntry | null>(null);
  const [localPending, setLocalPending] = useState(false);

  const isFormOpen = mode !== 'closed';
  const isEditing = mode === 'editing';
  const pending = isSaving || isDeleting || localPending;
  const totalIncomeCents = incomeEntries.reduce((sum, e) => sum + Math.max(0, e.amountCents), 0);

  const resetForm = useCallback(() => {
    setMode('closed');
    setAmount('');
    setNote('');
    setAmountError(null);
    setEditingEntryId(null);
  }, []);

  const focusAmountInput = useCallback(() => {
    requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    });
  }, []);

  const startAddMode = useCallback(() => {
    flushSync(() => {
      setMode('adding');
      setEditingEntryId(null);
      setAmount('');
      setNote('');
      setAmountError(null);
    });
    focusAmountInput();
  }, [focusAmountInput]);

  const startEditEntry = useCallback(
    (entry: IncomeEntry) => {
      const cents = Number(entry.amountCents);
      const label = incomeDisplayLabel(entry);
      flushSync(() => {
        setMode('editing');
        setEditingEntryId(entry.id);
        setAmount(amountToInputValue(cents));
        // Prefer stored note; fall back to display label so the field is not blank.
        setNote(entry.note?.trim() || label);
        setAmountError(null);
      });
      focusAmountInput();
    },
    [focusAmountInput],
  );

  const handleCancel = useCallback(() => {
    resetForm();
    onRequestClose?.();
  }, [onRequestClose, resetForm]);

  const parseAmountCents = (): number | null => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setAmountError('Enter an amount greater than 0');
      return null;
    }
    const cents = eurosToCents(value);
    if (cents <= 0) {
      setAmountError('Enter an amount greater than 0');
      return null;
    }
    setAmountError(null);
    return cents;
  };

  const handleSubmit = async () => {
    if (pending || !isFormOpen) return;
    const cents = parseAmountCents();
    if (cents == null) return;

    const trimmedNote = note.trim() || undefined;
    setLocalPending(true);
    try {
      if (mode === 'editing' && editingEntryId) {
        await onUpdate(editingEntryId, cents, trimmedNote);
      } else {
        await onSave(cents, trimmedNote);
      }
      resetForm();
    } finally {
      setLocalPending(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || pending) return;
    setLocalPending(true);
    try {
      await onDelete(deleteTarget.id);
      if (editingEntryId === deleteTarget.id) {
        resetForm();
      }
      setDeleteTarget(null);
    } finally {
      setLocalPending(false);
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      openEdit: () => {
        startAddMode();
        document
          .getElementById('salary-setup-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
      editEntry: (entry: IncomeEntry) => {
        startEditEntry(entry);
        document
          .getElementById('salary-setup-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    }),
    [startAddMode, startEditEntry],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || deleteTarget || !isFormOpen) return;
      e.preventDefault();
      handleCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget, handleCancel, isFormOpen]);

  const formTitle = isEditing ? 'Edit income' : 'Add income';
  const primaryLabel = pending
    ? isEditing
      ? 'Saving…'
      : 'Adding…'
    : isEditing
      ? 'Save changes'
      : 'Add income';

  const amountValid = (() => {
    const value = parseFloat(amount);
    return Number.isFinite(value) && value > 0 && eurosToCents(value) > 0;
  })();

  return (
    <div
      id="salary-setup-section"
      className={cn(embedded ? 'animate-scale-in' : 'animate-scale-in rounded-2xl border border-border bg-card p-5')}
      style={embedded ? undefined : { boxShadow: 'var(--shadow-md)' }}
    >
      <p className="label-caps mb-3">Income entries</p>

      {incomeEntries.length > 0 ? (
        <ul className="space-y-2" role="list">
          {incomeEntries.map((entry) => {
            const label = incomeDisplayLabel(entry);
            const iconKey = inferIncomeIconKey(label);
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-3 py-2.5 sm:px-3.5"
              >
                <BudgetIconCell iconKey={iconKey} label={label} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">Received this cycle</p>
                </div>
                <span className="shrink-0 font-bold money-display text-sm sm:text-base">
                  {formatMoney(entry.amountCents, currency)}
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="btn-icon"
                    title="Edit"
                    aria-label={`Edit ${label} income`}
                    disabled={pending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      startEditEntry(entry);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn-icon text-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                    title="Delete"
                    aria-label={`Delete ${label} income`}
                    disabled={pending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteTarget(entry);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {incomeEntries.length > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <span className="text-sm text-muted-foreground">Total income this cycle</span>
          <span className="font-bold money-display text-sm sm:text-base">
            {formatMoney(totalIncomeCents, currency)}
          </span>
        </div>
      ) : null}

      {!isFormOpen ? (
        <div className={cn(incomeEntries.length > 0 ? 'mt-4' : '')}>
          <button
            type="button"
            className="btn-primary h-10 px-4"
            disabled={pending}
            onClick={startAddMode}
          >
            Add income
          </button>
        </div>
      ) : (
        <div
          ref={formSectionRef}
          className={cn(
            incomeEntries.length > 0 ? 'mt-4 border-t border-dashed border-border/70 pt-4' : 'mt-4',
          )}
        >
          {(previousCycleIncomeCents ?? 0) > 0 && incomeEntries.length === 0 && mode === 'adding' ? (
            <p className="mb-3 text-xs text-muted-foreground">
              Previous cycle income:{' '}
              <span className="font-medium text-foreground">
                {formatMoney(previousCycleIncomeCents!, currency)}
              </span>
              <span className="ml-1">(reference only)</span>
            </p>
          ) : null}

          <p className="mb-3 text-sm font-semibold text-foreground">{formTitle}</p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 sm:w-40 sm:shrink-0">
              <label
                htmlFor="income-amount-input"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 min-w-[1.25rem] -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  {getCurrencySymbol(currency)}
                </span>
                <input
                  ref={amountInputRef}
                  id="income-amount-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  disabled={pending}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (amountError) setAmountError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="0.00"
                  className={cn('input-clean h-11 pl-9 pr-3 font-mono text-base', amountError && 'border-destructive')}
                  aria-invalid={amountError ? true : undefined}
                  aria-describedby={amountError ? 'income-amount-error' : undefined}
                />
              </div>
              {amountError ? (
                <p id="income-amount-error" className="mt-1 text-xs text-destructive" role="alert">
                  {amountError}
                </p>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <label
                htmlFor="income-note-input"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Note (optional)
              </label>
              <input
                id="income-note-input"
                type="text"
                value={note}
                disabled={pending}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="e.g. Salary, freelance, bonus"
                className="input-clean h-11 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-primary h-10 px-4"
                disabled={pending || !amountValid}
                onClick={() => void handleSubmit()}
              >
                {primaryLabel}
              </button>
              <button
                type="button"
                className="btn-ghost h-10 px-3 text-sm font-medium text-muted-foreground"
                disabled={pending}
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Enter saves · Esc cancels</p>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null);
        }}
        title="Delete income?"
        description={
          deleteTarget
            ? `This will remove ${formatMoney(deleteTarget.amountCents, currency)} from the current cycle and recalculate your Safe to Spend.`
            : 'This will remove this income from the current cycle and recalculate your Safe to Spend.'
        }
        onConfirm={handleDeleteConfirm}
        isConfirming={pending && deleteTarget !== null}
        confirmLabel="Delete income"
        confirmingLabel="Deleting…"
      />
    </div>
  );
});
