import { TrendingDown, TrendingUp, Wallet, PiggyBank } from 'lucide-react';
import { formatMoney, calculateSpentPercentage } from '@/utils/money';
import { AnimatedMoney } from '@/components/AnimatedMoney';

interface BudgetSummaryProps {
  salaryCents: number;
  totalSpentCents: number;
  remainingCents: number;
}

export function BudgetSummary({ salaryCents, totalSpentCents, remainingCents }: BudgetSummaryProps) {
  const spentPercentage = calculateSpentPercentage(totalSpentCents, salaryCents);
  const isOverBudget = remainingCents < 0;
  const isWarning = spentPercentage > 75 && !isOverBudget;

  return (
    <div className="card-elevated p-6 animate-fade-in space-y-6">
      {/* Remaining - Hero display */}
      <div className="text-center py-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
          Remaining this month
        </p>
        <AnimatedMoney
          cents={remainingCents}
          className={`inline-block align-middle text-5xl md:text-6xl font-bold money-display ${
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
        <div className="flex justify-between text-sm mb-2.5">
          <span className="text-muted-foreground font-medium">Budget used</span>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/60">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)', opacity: 0.15 }}>
            <TrendingUp className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Income</p>
            <p className="font-bold money-display text-sm">{formatMoney(salaryCents)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/60">
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
            <p className="font-bold money-display text-sm">{formatMoney(totalSpentCents)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
