import {
  BudgetMoneyColumns,
  BudgetMoneyColumnsMobile,
  budgetRemainingTone,
} from "@/components/budget/BudgetMoneyColumns";
import { cn } from "@/lib/utils";

export interface BudgetTotalRowProps {
  label: string;
  plannedCents: number;
  actualCents: number;
  remainingCents: number;
  currency?: string;
  className?: string;
}

export function BudgetTotalRow({
  label,
  plannedCents,
  actualCents,
  remainingCents,
  currency = "EUR",
  className,
}: BudgetTotalRowProps) {
  return (
    <div className={cn("budget-total-row px-3 py-3 sm:px-4", className)}>
      <div className="budget-cols-grid">
        <span className="budget-icon-cell" aria-hidden />
        <p className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-[15px]">
          {label}
        </p>
        <BudgetMoneyColumns
          plannedCents={plannedCents}
          actualCents={actualCents}
          remainingCents={remainingCents}
          currency={currency}
        />
      </div>

      <div className="sm:hidden">
        <BudgetMoneyColumnsMobile
          plannedCents={plannedCents}
          actualCents={actualCents}
          remainingCents={remainingCents}
          currency={currency}
        />
      </div>
    </div>
  );
}

/** Re-export for callers that need remaining tone without importing MoneyColumns. */
export { budgetRemainingTone };
