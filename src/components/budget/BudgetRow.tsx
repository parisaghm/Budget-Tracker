import { Link } from "react-router-dom";
import { formatMoney } from "@/utils/money";
import type { BudgetMoneyRow } from "@/utils/budgetPageModel";
import { BudgetProgressBar } from "@/components/budget/BudgetProgressBar";
import { CategoryLimitPopover } from "@/components/budget/CategoryLimitPopover";
import { BudgetIconCell } from "@/components/budget/BudgetIconCell";
import {
  BudgetMoneyColumns,
  BudgetMoneyColumnsMobile,
} from "@/components/budget/BudgetMoneyColumns";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface BudgetRowProps {
  row: BudgetMoneyRow;
  currency?: string;
  paletteIndex?: number;
  onSetCategoryLimit?: (categoryValue: string, limitCents: number) => void;
  className?: string;
}

export function BudgetRow({
  row,
  currency = "EUR",
  onSetCategoryLimit,
  className,
}: BudgetRowProps) {
  const hasPlan = row.plannedCents > 0;
  const showBar =
    row.sourceType !== "income_entry" && (hasPlan || row.actualCents > 0);
  const [editOpen, setEditOpen] = useState(false);
  const canEditLimit =
    row.sourceType === "category_budget" &&
    row.categoryValue &&
    onSetCategoryLimit;

  return (
    <li id={row.id} className={cn("budget-money-row", className)}>
      <div className="px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="budget-cols-grid">
          <BudgetIconCell iconKey={row.iconKey} label={row.label} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-foreground sm:text-[15px]">
                {row.label}
              </p>
              {canEditLimit ? (
                <CategoryLimitPopover
                  categoryLabel={row.label}
                  currency={currency}
                  currentLimitCents={row.plannedCents}
                  onSave={(cents) => onSetCategoryLimit!(row.categoryValue!, cents)}
                  variant="button"
                  open={editOpen}
                  onOpenChange={setEditOpen}
                />
              ) : null}
            </div>
            {row.subtitle ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.subtitle}</p>
            ) : null}
            {row.overPlanCents != null && row.overPlanCents > 0 ? (
              <p className="mt-1 text-xs font-medium text-destructive">
                {formatMoney(row.overPlanCents, currency)} over plan ·{" "}
                <Link to="/expenses" className="underline-offset-2 hover:underline">
                  Review spending
                </Link>
              </p>
            ) : row.needsBudget ? (
              <p className="mt-1 text-xs text-muted-foreground">Needs a budget</p>
            ) : null}

            <BudgetMoneyColumnsMobile
              plannedCents={row.plannedCents}
              actualCents={row.actualCents}
              remainingCents={row.remainingCents}
              currency={currency}
            />
          </div>

          <BudgetMoneyColumns
            plannedCents={row.plannedCents}
            actualCents={row.actualCents}
            remainingCents={row.remainingCents}
            currency={currency}
          />
        </div>

        {showBar ? (
          <BudgetProgressBar
            className="mt-2.5 sm:ml-[calc(2.5rem+0.75rem)]"
            progressPct={row.progressPct}
            status={row.status}
            visible
          />
        ) : null}
      </div>
    </li>
  );
}
