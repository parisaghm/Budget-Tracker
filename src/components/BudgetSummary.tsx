import type { ReactNode } from 'react';
import { Pencil, TrendingDown, TrendingUp } from 'lucide-react';
import { formatMoney, calculateSpentPercentage } from '@/utils/money';
import { AnimatedMoney } from '@/components/AnimatedMoney';

interface BudgetSummaryProps {
  salaryCents: number;
  totalSpentCents: number;
  remainingCents: number;
  currency?: string;
  /** Opens monthly salary editing. */
  onEditSalary?: () => void;
  /** Monthly salary + note inputs rendered above the safe-to-spend hero. */
  salaryControls?: ReactNode;
}

export function BudgetSummary({
  salaryCents,
  totalSpentCents,
  remainingCents,
  currency = 'EUR',
  onEditSalary,
  salaryControls,
}: BudgetSummaryProps) {
  const spentPercentage = calculateSpentPercentage(totalSpentCents, salaryCents);
  const isOverBudget = remainingCents < 0;
  const isWarning = spentPercentage > 75 && !isOverBudget;

  return (
    <div className="card-elevated animate-fade-in space-y-5 p-5 sm:p-6 sm:space-y-6">
      {salaryControls ? (
        <div className="-mt-0.5 border-b border-border/60 pb-4 sm:pb-5">{salaryControls}</div>
      ) : null}

      {/* Remaining - Hero display */}
      <div className="py-1 text-center sm:py-2">
        <div className="mb-2 flex items-center justify-center gap-2">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-wider">
            Safe to spend
          </p>
          {onEditSalary && (
            <button
              type="button"
              onClick={onEditSalary}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Edit monthly salary"
              title="Edit monthly salary"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        <AnimatedMoney
          cents={remainingCents}
          className={`money-display inline-block align-middle text-[clamp(2.25rem,8vw,3.75rem)] font-bold leading-none md:text-6xl ${
            isOverBudget ? 'text-destructive' : isWarning ? 'text-warning' : 'text-foreground'
          }`}
        />
        {isOverBudget && (
          <p className="text-sm text-destructive mt-2 font-semibold">
            Over budget by {formatMoney(Math.abs(remainingCents))}
          </p>
        )}
      </div>

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
    </div>
  );
}
