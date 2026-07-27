import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryIconAvatar } from "@/components/CategoryIconAvatar";
import {
  managementStatusBarColor,
  resolveCategoryManagementStatus,
} from "@/utils/categoryBudgetStatus";
import { formatMoney } from "@/utils/money";
import { CategoryLimitPopover } from "@/components/budget/CategoryLimitPopover";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { cn } from "@/lib/utils";

export interface CategoryBudgetRowProps {
  categoryValue: string;
  categoryLabel: string;
  iconKey: string;
  isCustom?: boolean;
  paletteIndex: number;
  spentCents: number;
  limitCents: number;
  progressPct: number;
  currency?: string;
  showAttentionIcon?: boolean;
  onSetCategoryLimit?: (limitCents: number) => void;
  onDeleteCategory?: (categoryValue: string) => { success: true } | { success: false; error: string };
}

function budgetRowStatusLabel(
  spentCents: number,
  limitCents: number,
  currency: string,
): string {
  const hasLimit = limitCents > 0;
  if (!hasLimit) {
    return "No limit set";
  }

  const status = resolveCategoryManagementStatus(spentCents, limitCents);
  if (status === "over") {
    return `${formatMoney(spentCents - limitCents, currency)} over budget`;
  }

  const remaining = limitCents - spentCents;
  return `${formatMoney(remaining, currency)} remaining`;
}

export function CategoryBudgetRow({
  categoryValue,
  categoryLabel,
  iconKey,
  isCustom = false,
  paletteIndex,
  spentCents,
  limitCents,
  progressPct,
  currency = "EUR",
  showAttentionIcon = false,
  onSetCategoryLimit,
  onDeleteCategory,
}: CategoryBudgetRowProps) {
  const hasLimit = limitCents > 0;
  const managementStatus = resolveCategoryManagementStatus(spentCents, limitCents);
  const fillColor = managementStatusBarColor(managementStatus);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const statusLabel = budgetRowStatusLabel(spentCents, limitCents, currency);
  const displayPct = hasLimit ? progressPct : 0;
  const barWidth = hasLimit ? Math.min(displayPct, 100) : 0;
  const isOver = managementStatus === "over";
  const canDelete = isCustom && onDeleteCategory != null;

  const handleDeleteConfirm = () => {
    if (!onDeleteCategory) return;
    const result = onDeleteCategory(categoryValue);
    if (result.success) {
      setDeleteOpen(false);
      return;
    }
    toast.error("Category not deleted", { description: result.error });
    setDeleteOpen(false);
  };

  return (
    <>
      <li
        id={`budget-cat-${categoryValue}`}
        className="budget-category-row group rounded-lg border border-border/50 bg-card/30 transition-colors hover:bg-accent/20"
      >
        <div className="flex min-w-0 items-start gap-2 p-2.5">
          <CategoryIconAvatar
            categoryValue={categoryValue}
            iconKey={iconKey}
            label={categoryLabel}
            paletteIndex={paletteIndex}
            size="sm"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {showAttentionIcon ? (
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0 text-warning"
                  aria-hidden
                />
              ) : null}
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                {categoryLabel}
              </p>
            </div>

            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
              <p className="text-xs text-muted-foreground">
                Spent{" "}
                <span className="money-display font-semibold tabular-nums text-foreground">
                  {formatMoney(spentCents, currency)}
                </span>
              </p>
              {hasLimit ? (
                <p className="text-xs text-muted-foreground">
                  Limit{" "}
                  <span className="money-display font-semibold tabular-nums text-foreground">
                    {formatMoney(limitCents, currency)}
                  </span>
                </p>
              ) : null}
            </div>

            {hasLimit ? (
              <div className="mt-1.5">
                <div className="progress-track h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: fillColor,
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p
                className={cn(
                  "truncate text-xs",
                  isOver && "font-medium text-destructive",
                  !hasLimit && "text-muted-foreground",
                  hasLimit && !isOver && "text-muted-foreground",
                )}
              >
                {statusLabel}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                {onSetCategoryLimit ? (
                  <CategoryLimitPopover
                    categoryLabel={categoryLabel}
                    currency={currency}
                    currentLimitCents={limitCents}
                    onSave={onSetCategoryLimit}
                    variant="button"
                    open={editOpen}
                    onOpenChange={setEditOpen}
                  />
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-destructive/20 bg-destructive/[0.04] text-destructive transition-colors hover:bg-destructive/10"
                    aria-label={`Delete ${categoryLabel} category`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </li>
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete category?"
        description="This removes the custom category permanently. Categories with expenses cannot be deleted."
        detail={categoryLabel}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
