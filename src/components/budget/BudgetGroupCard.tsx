import { useState, type ReactNode } from "react";
import type { BudgetGroupModel, BudgetMoneyRow } from "@/utils/budgetPageModel";
import { BudgetGroupHeader } from "@/components/budget/BudgetGroupHeader";
import { BudgetRow } from "@/components/budget/BudgetRow";
import { cn } from "@/lib/utils";

export interface BudgetGroupCardProps {
  group: BudgetGroupModel;
  currency?: string;
  defaultExpanded?: boolean;
  onSetCategoryLimit?: (categoryValue: string, limitCents: number) => void;
  footer?: ReactNode;
  emptyMessage?: string;
  className?: string;
  /** Override rows (e.g. filtered). Defaults to group.rows. */
  rows?: BudgetMoneyRow[];
}

export function BudgetGroupCard({
  group,
  currency = "EUR",
  defaultExpanded = true,
  onSetCategoryLimit,
  footer,
  emptyMessage = "Nothing in this group yet.",
  className,
  rows,
}: BudgetGroupCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const displayRows = rows ?? group.rows;

  return (
    <section
      className={cn(
        "budget-group-card overflow-hidden rounded-[1.25rem] border border-border/80",
        className,
      )}
      aria-labelledby={`budget-group-${group.id}`}
    >
      <BudgetGroupHeader
        groupId={group.id}
        title={group.title}
        count={displayRows.length}
        plannedCents={group.plannedCents}
        actualCents={group.actualCents}
        remainingCents={group.remainingCents}
        currency={currency}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />

      {expanded ? (
        <>
          {displayRows.length === 0 ? (
            <p className="border-t border-border/50 px-4 py-4 text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            <ul className="border-t border-border/50" role="list">
              {displayRows.map((row, index) => (
                <BudgetRow
                  key={row.id}
                  row={row}
                  currency={currency}
                  paletteIndex={index}
                  onSetCategoryLimit={onSetCategoryLimit}
                />
              ))}
            </ul>
          )}
          {footer ? (
            <div className="border-t border-border/50 px-3 py-2.5 sm:px-4">{footer}</div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
