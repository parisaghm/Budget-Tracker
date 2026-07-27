import { ChevronDown } from "lucide-react";
import { BudgetStatusBadge } from "@/components/budget/BudgetStatusBadge";
import { BudgetMoneyColumns } from "@/components/budget/BudgetMoneyColumns";
import { cn } from "@/lib/utils";

export interface BudgetGroupHeaderProps {
  groupId: string;
  title: string;
  count: number;
  plannedCents: number;
  actualCents: number;
  remainingCents: number;
  currency?: string;
  expanded: boolean;
  onToggle: () => void;
}

export function BudgetGroupHeader({
  groupId,
  title,
  count,
  plannedCents,
  actualCents,
  remainingCents,
  currency = "EUR",
  expanded,
  onToggle,
}: BudgetGroupHeaderProps) {
  return (
    <button
      type="button"
      className="budget-cols-grid w-full px-3 py-3 text-left transition-colors hover:bg-accent/20 sm:px-4"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <span className="budget-icon-cell flex h-8 w-8 items-center justify-center justify-self-center">
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            !expanded && "-rotate-90",
          )}
          aria-hidden
        />
      </span>

      <div className="flex min-w-0 items-center gap-2">
        <h3
          id={`budget-group-${groupId}`}
          className="truncate font-display text-[1.05rem] font-semibold tracking-tight text-foreground sm:text-lg"
        >
          {title}
        </h3>
        <BudgetStatusBadge count={count} />
      </div>

      <BudgetMoneyColumns
        plannedCents={plannedCents}
        actualCents={actualCents}
        remainingCents={remainingCents}
        currency={currency}
      />
    </button>
  );
}
