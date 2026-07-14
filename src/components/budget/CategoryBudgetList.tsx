import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, Plus } from "lucide-react";
import type { CategoryBudgetSnapshot } from "@/utils/budgetPlanning";
import {
  getAttentionCount,
  groupCategorySnapshots,
  type CategoryBudgetViewMode,
} from "@/utils/budgetPlanning";
import { CategoryBudgetRow } from "@/components/budget/CategoryBudgetRow";
import { cn } from "@/lib/utils";

export interface CategoryBudgetListProps {
  snapshots: CategoryBudgetSnapshot[];
  currency?: string;
  onSetCategoryLimit?: (categoryValue: string, limitCents: number) => void;
  onDeleteCategory?: (categoryValue: string) => { success: true } | { success: false; error: string };
}

function CategoryRows({
  items,
  currency,
  showAttentionIcon,
  onSetCategoryLimit,
  onDeleteCategory,
  paletteOffset = 0,
}: {
  items: CategoryBudgetSnapshot[];
  currency: string;
  showAttentionIcon?: boolean;
  onSetCategoryLimit?: (categoryValue: string, limitCents: number) => void;
  onDeleteCategory?: (categoryValue: string) => { success: true } | { success: false; error: string };
  paletteOffset?: number;
}) {
  return (
    <ul className="budget-category-list mt-1.5 space-y-1" role="list">
      {items.map((snap, index) => (
        <CategoryBudgetRow
          key={snap.categoryValue}
          categoryValue={snap.categoryValue}
          categoryLabel={snap.categoryLabel}
          iconKey={snap.iconKey}
          isCustom={snap.isCustom}
          paletteIndex={paletteOffset + index}
          spentCents={snap.spentCents}
          limitCents={snap.limitCents}
          progressPct={snap.progressPct}
          currency={currency}
          showAttentionIcon={showAttentionIcon}
          onSetCategoryLimit={
            onSetCategoryLimit
              ? (cents) => onSetCategoryLimit(snap.categoryValue, cents)
              : undefined
          }
          onDeleteCategory={onDeleteCategory}
        />
      ))}
    </ul>
  );
}

export function CategoryBudgetList({
  snapshots,
  currency = "EUR",
  onSetCategoryLimit,
  onDeleteCategory,
}: CategoryBudgetListProps) {
  const [viewMode, setViewMode] = useState<CategoryBudgetViewMode>("all");
  const [noLimitExpanded, setNoLimitExpanded] = useState(false);

  const attentionCount = useMemo(() => getAttentionCount(snapshots), [snapshots]);
  const groups = useMemo(() => groupCategorySnapshots(snapshots), [snapshots]);

  const scrollToNeedsAttention = () => {
    document.getElementById("budget-needs-attention")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "all" ? "issues" : "all"));
  };

  const showBudgeted = viewMode === "all";
  const showNoLimit = viewMode === "all";

  return (
    <section
      className="budget-category-sections w-full"
      aria-labelledby="category-budgets-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="category-budgets-heading" className="heading-card text-base">
          Category budgets
        </h2>
        <Link
          to="/expenses"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add
        </Link>
      </div>

      {attentionCount > 0 ? (
        <div
          className="budget-attention-banner mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-warning/25 bg-warning/[0.06] px-2.5 py-2"
          role="status"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
            {attentionCount} {attentionCount === 1 ? "category needs" : "categories need"}{" "}
            attention
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={scrollToNeedsAttention}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View issues
            </button>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={toggleViewMode}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {viewMode === "all" ? "Show issues only" : "Show all"}
            </button>
          </span>
        </div>
      ) : null}

      {groups.needsAttention.length > 0 ? (
        <div id="budget-needs-attention" className="budget-category-group mt-3 scroll-mt-4">
          <h3 className="label-caps text-[10px] tracking-[0.12em] text-foreground">
            Needs Attention
          </h3>
          <CategoryRows
            items={groups.needsAttention}
            currency={currency}
            showAttentionIcon
            onSetCategoryLimit={onSetCategoryLimit}
            onDeleteCategory={onDeleteCategory}
            paletteOffset={0}
          />
        </div>
      ) : null}

      {showBudgeted && groups.budgeted.length > 0 ? (
        <div className="budget-category-group mt-3">
          <h3 className="label-caps text-[10px] tracking-[0.12em] text-foreground">
            Budgeted Categories
          </h3>
          <CategoryRows
            items={groups.budgeted}
            currency={currency}
            onSetCategoryLimit={onSetCategoryLimit}
            onDeleteCategory={onDeleteCategory}
            paletteOffset={groups.needsAttention.length}
          />
        </div>
      ) : null}

      {showNoLimit && groups.noLimit.length > 0 ? (
        <div className="budget-category-group mt-3">
          <button
            type="button"
            onClick={() => setNoLimitExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2 rounded-md py-0.5 text-left"
            aria-expanded={noLimitExpanded}
            aria-controls="budget-no-limit-list"
          >
            <h3 className="label-caps text-[10px] tracking-[0.12em] text-muted-foreground">
              No Limit Categories ({groups.noLimit.length})
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
              {noLimitExpanded ? "Collapse" : "Expand"}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  noLimitExpanded && "rotate-180",
                )}
                aria-hidden
              />
            </span>
          </button>
          {noLimitExpanded ? (
            <div id="budget-no-limit-list">
              <CategoryRows
                items={groups.noLimit}
                currency={currency}
                onSetCategoryLimit={onSetCategoryLimit}
                onDeleteCategory={onDeleteCategory}
                paletteOffset={groups.needsAttention.length + groups.budgeted.length}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {snapshots.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No categories yet. Add expenses to start budgeting.
        </p>
      ) : null}
    </section>
  );
}
