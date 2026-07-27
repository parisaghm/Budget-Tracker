import { cn } from "@/lib/utils";

export interface BudgetSectionHeaderProps {
  title: string;
  className?: string;
  showColumnLabels?: boolean;
}

export function BudgetSectionHeader({
  title,
  className,
  showColumnLabels = true,
}: BudgetSectionHeaderProps) {
  return (
    <div
      className={cn(
        "budget-section-header budget-cols-grid mb-3 rounded-xl border border-border/80 bg-secondary/90 px-3 py-2 sm:px-4",
        className,
      )}
    >
      {/* Spacer aligns with icon/chevron column in group rows */}
      <span className="budget-icon-cell" aria-hidden />
      <h2 className="budget-section-header__title min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      {showColumnLabels ? (
        <>
          <span className="budget-col-label hidden text-right text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground sm:block">
            Planned
          </span>
          <span className="budget-col-label hidden text-right text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground sm:block">
            Actual
          </span>
          <span className="budget-col-label hidden text-right text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground sm:block">
            Remaining
          </span>
        </>
      ) : (
        <>
          <span className="hidden sm:block" aria-hidden />
          <span className="hidden sm:block" aria-hidden />
          <span className="hidden sm:block" aria-hidden />
        </>
      )}
    </div>
  );
}
