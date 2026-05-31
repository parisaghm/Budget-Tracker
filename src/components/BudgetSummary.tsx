import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Check, TrendingDown, TrendingUp } from 'lucide-react';
import {
  centsToEuros,
  eurosToCents,
  formatMoney,
  calculateSpentPercentage,
  getCurrencySymbol,
} from '@/utils/money';
import { AnimatedMoney } from '@/components/AnimatedMoney';
import { describeDashboardSafeToSpend, type SafeToSpendBreakdown } from '@/utils/safeToSpend';

interface BudgetSummaryProps {
  salaryCents: number;
  totalSpentCents: number;
  remainingCents: number;
  currency?: string;
  /** Optional: adjust displayed safe-to-spend via plan changes (never monthly income). */
  onSaveSafeToSpend?: (remainingCents: number) => void;
  /** Monthly salary + note inputs rendered above the safe-to-spend hero. */
  salaryControls?: ReactNode;
  /** Used to explain zero or negative safe-to-spend. */
  safeToSpendBreakdown?: SafeToSpendBreakdown;
  /** Home view: hero only, no progress row or income/spent tiles. */
  variant?: "default" | "compact";
  weeklySafeToSpendCents?: number;
}

export function BudgetSummary({
  salaryCents,
  totalSpentCents,
  remainingCents,
  currency = 'EUR',
  onSaveSafeToSpend,
  salaryControls,
  safeToSpendBreakdown,
  variant = 'default',
  weeklySafeToSpendCents,
}: BudgetSummaryProps) {
  const isCompact = variant === 'compact';
  const spentPercentage = calculateSpentPercentage(totalSpentCents, salaryCents);
  const isOverBudget = remainingCents < 0;
  const isWarning = spentPercentage > 75 && !isOverBudget;
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [editAmount, setEditAmount] = useState('');

  const safeToSpendExplanation = useMemo(() => {
    if (!safeToSpendBreakdown) return null;
    return describeDashboardSafeToSpend(remainingCents, safeToSpendBreakdown, currency);
  }, [currency, remainingCents, safeToSpendBreakdown]);

  useEffect(() => {
    if (!isEditingAmount) return;
    setEditAmount(centsToEuros(remainingCents).toString());
  }, [isEditingAmount, remainingCents]);

  const startEditing = () => {
    if (!onSaveSafeToSpend) return;
    setEditAmount(centsToEuros(remainingCents).toString());
    setIsEditingAmount(true);
  };

  const handleSaveAmount = () => {
    const value = parseFloat(editAmount);
    if (!isNaN(value) && onSaveSafeToSpend) {
      onSaveSafeToSpend(eurosToCents(value));
      setIsEditingAmount(false);
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveAmount();
    if (e.key === 'Escape') setIsEditingAmount(false);
  };

  const canEditAmount = Boolean(onSaveSafeToSpend);

  return (
    <div className="card-elevated animate-fade-in space-y-5 p-5 sm:p-6 sm:space-y-6">
      {salaryControls ? (
        <div className="-mt-0.5 border-b border-border/60 pb-4 sm:pb-5">{salaryControls}</div>
      ) : null}

      {/* Remaining - Hero display */}
      <div className="py-1 text-center sm:py-2">
        {canEditAmount ? (
          <button
            type="button"
            onClick={startEditing}
            disabled={isEditingAmount}
            className="mb-2 block w-full text-[13px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default sm:text-xs sm:tracking-wider"
            aria-label="Edit safe to spend"
          >
            Safe to spend
          </button>
        ) : (
          <p className="mb-2 text-[13px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-wider">
            Safe to spend
          </p>
        )}
        {isEditingAmount ? (
          <div className="mx-auto flex max-w-xs items-end justify-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                {getCurrencySymbol(currency)}
              </span>
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                onKeyDown={handleAmountKeyDown}
                className="input-clean money-display h-14 w-full pl-9 pr-3 text-center text-[clamp(1.75rem,6vw,2.5rem)] font-bold"
                autoFocus
                aria-label="Safe to spend amount"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveAmount}
              disabled={!editAmount || Number.isNaN(parseFloat(editAmount))}
              className="btn-primary h-14 w-14 shrink-0 p-0"
              aria-label="Save safe to spend"
            >
              <Check className="h-5 w-5" aria-hidden />
            </button>
          </div>
        ) : canEditAmount ? (
          <button
            type="button"
            onClick={startEditing}
            className={`money-display inline-block align-middle rounded-xl px-2 py-1 text-[clamp(2.25rem,8vw,3.75rem)] font-bold leading-none transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-6xl ${
              isOverBudget ? 'text-destructive' : isWarning ? 'text-warning' : 'text-foreground'
            }`}
            aria-label={`Edit safe to spend, currently ${formatMoney(remainingCents, currency)}`}
          >
            <AnimatedMoney
              cents={remainingCents}
              className={isOverBudget ? 'text-destructive' : isWarning ? 'text-warning' : 'text-foreground'}
            />
          </button>
        ) : (
          <AnimatedMoney
            cents={remainingCents}
            className={`money-display inline-block align-middle text-[clamp(2.25rem,8vw,3.75rem)] font-bold leading-none md:text-6xl ${
              isOverBudget ? 'text-destructive' : isWarning ? 'text-warning' : 'text-foreground'
            }`}
          />
        )}
        {isOverBudget && !safeToSpendExplanation && (
          <p className="text-sm text-destructive mt-2 font-semibold">
            Over budget by {formatMoney(Math.abs(remainingCents), currency)}
          </p>
        )}
        {safeToSpendExplanation ? (
          <p className={`mt-2 max-w-md mx-auto text-sm leading-relaxed ${isOverBudget ? 'text-destructive' : 'text-muted-foreground'}`}>
            {safeToSpendExplanation}
          </p>
        ) : null}
        {isCompact && weeklySafeToSpendCents != null && weeklySafeToSpendCents > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            About {formatMoney(weeklySafeToSpendCents, currency)} per week left this month
          </p>
        ) : null}
      </div>

      {isCompact ? null : (
      <>
      {/* Progress bar */}
      <div>
        <div className="mb-2.5 flex justify-between text-sm sm:text-sm">
          <span className="font-medium text-muted-foreground">Budget used</span>
          <span className={`font-bold ${
            isOverBudget ? 'text-destructive' : isWarning ? 'text-warning' : 'text-primary'
          }`}>
            {spentPercentage}%
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-bar"
            style={{
              width: `${Math.min(spentPercentage, 100)}%`,
              background: isOverBudget
                ? 'hsl(var(--destructive))'
                : isWarning
                  ? 'hsl(var(--warning))'
                  : undefined,
            }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl bg-muted/60 p-3 sm:p-4">
          <div className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden ring-1 ring-primary/20 shadow-sm">
            <div
              className="absolute inset-0 opacity-20"
              style={{ background: 'var(--gradient-primary)' }}
              aria-hidden="true"
            />
            <TrendingUp className="w-5 h-5 text-primary relative z-10" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Income</p>
            <p className="font-bold money-display text-sm">{formatMoney(salaryCents, currency)}</p>
          </div>
        </div>
        <div className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl bg-muted/60 p-3 sm:p-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isOverBudget ? 'bg-destructive/10' : 'bg-accent/20'
          }`}>
            {isOverBudget ? (
              <TrendingDown className="w-4 h-4 text-destructive" />
            ) : (
              <TrendingUp className="w-4 h-4 text-accent" />
            )}
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Spent</p>
            <p className="font-bold money-display text-sm">{formatMoney(totalSpentCents, currency)}</p>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
