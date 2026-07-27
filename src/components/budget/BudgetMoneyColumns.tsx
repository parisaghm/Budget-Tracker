import { formatMoney } from "@/utils/money";
import { cn } from "@/lib/utils";

export function budgetRemainingTone(remainingCents: number): string {
  if (remainingCents < 0) return "text-destructive";
  return "text-success";
}

export interface BudgetMoneyColumnsProps {
  plannedCents: number;
  actualCents: number;
  remainingCents: number;
  currency?: string;
  /** Hide on small screens (desktop grid columns). */
  desktopOnly?: boolean;
  className?: string;
}

/** Planned / Actual / Remaining cells — shared hierarchy and alignment. */
export function BudgetMoneyColumns({
  plannedCents,
  actualCents,
  remainingCents,
  currency = "EUR",
  desktopOnly = true,
  className,
}: BudgetMoneyColumnsProps) {
  const hide = desktopOnly ? "hidden sm:block" : "block";

  return (
    <>
      <p
        className={cn(
          "budget-money-amount money-display text-sm font-semibold tabular-nums text-foreground",
          hide,
          className,
        )}
      >
        {formatMoney(plannedCents, currency)}
      </p>
      <p
        className={cn(
          "budget-money-amount money-display text-sm font-normal tabular-nums text-muted-foreground",
          hide,
          className,
        )}
      >
        {formatMoney(actualCents, currency)}
      </p>
      <p
        className={cn(
          "budget-money-amount money-display text-sm font-medium tabular-nums",
          budgetRemainingTone(remainingCents),
          hide,
          className,
        )}
      >
        {formatMoney(remainingCents, currency)}
      </p>
    </>
  );
}

export interface BudgetMoneyColumnsMobileProps {
  plannedCents: number;
  actualCents: number;
  remainingCents: number;
  currency?: string;
}

/** Compact 3-column amount strip for narrow viewports. */
export function BudgetMoneyColumnsMobile({
  plannedCents,
  actualCents,
  remainingCents,
  currency = "EUR",
}: BudgetMoneyColumnsMobileProps) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 text-right sm:hidden">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Planned
        </p>
        <p className="money-display text-sm font-semibold tabular-nums text-foreground">
          {formatMoney(plannedCents, currency)}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Actual
        </p>
        <p className="money-display text-sm font-normal tabular-nums text-muted-foreground">
          {formatMoney(actualCents, currency)}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Remaining
        </p>
        <p
          className={cn(
            "money-display text-sm font-medium tabular-nums",
            budgetRemainingTone(remainingCents),
          )}
        >
          {formatMoney(remainingCents, currency)}
        </p>
      </div>
    </div>
  );
}
