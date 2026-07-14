import type { CategoryDef, Expense } from "@/types/finance";
import {
  resolveCategoryManagementStatus,
  type CategoryManagementStatus,
} from "@/utils/categoryBudgetStatus";

export const BUDGET_ATTENTION_THRESHOLD = 0.8;

export type CategoryBudgetFilter = "all" | "over" | "near" | "no_limit";

export type CategoryBudgetViewMode = "all" | "issues";

export interface CategoryBudgetGroups {
  needsAttention: CategoryBudgetSnapshot[];
  budgeted: CategoryBudgetSnapshot[];
  noLimit: CategoryBudgetSnapshot[];
}

export interface CategoryBudgetSnapshot {
  categoryValue: string;
  categoryLabel: string;
  iconKey: string;
  isCustom: boolean;
  limitCents: number;
  spentCents: number;
  remainingCents: number;
  isOver: boolean;
  progressPct: number;
}

export interface BudgetPlanningSummary {
  incomeCents: number;
  assignedCents: number;
  unassignedCents: number;
  assignmentProgressPct: number;
  isOverAssigned: boolean;
  categorySnapshots: CategoryBudgetSnapshot[];
}

export function buildSpentByCategory(expenses: Expense[]): Record<string, number> {
  const map: Record<string, number> = {};
  expenses.forEach((exp) => {
    map[exp.category] = (map[exp.category] || 0) + exp.amountCents;
  });
  return map;
}

export function isCloseToLimit(
  spentCents: number,
  limitCents: number,
  threshold = BUDGET_ATTENTION_THRESHOLD,
): boolean {
  return resolveCategoryManagementStatus(spentCents, limitCents) === "near";
}

export function getCategoryManagementStatus(
  snap: CategoryBudgetSnapshot,
): CategoryManagementStatus {
  return resolveCategoryManagementStatus(snap.spentCents, snap.limitCents);
}

export function categoryNeedsAttention(snap: CategoryBudgetSnapshot): boolean {
  const status = getCategoryManagementStatus(snap);
  return (
    status === "over" ||
    status === "near" ||
    (status === "no_limit" && snap.spentCents > 0)
  );
}

export function getAttentionCount(snapshots: CategoryBudgetSnapshot[]): number {
  return snapshots.filter(categoryNeedsAttention).length;
}

export function groupCategorySnapshots(
  snapshots: CategoryBudgetSnapshot[],
): CategoryBudgetGroups {
  const needsAttention: CategoryBudgetSnapshot[] = [];
  const budgeted: CategoryBudgetSnapshot[] = [];
  const noLimit: CategoryBudgetSnapshot[] = [];

  for (const snap of snapshots) {
    if (categoryNeedsAttention(snap)) {
      needsAttention.push(snap);
    } else if (snap.limitCents > 0) {
      budgeted.push(snap);
    } else {
      noLimit.push(snap);
    }
  }

  return {
    needsAttention: sortCategorySnapshotsForManagement(needsAttention),
    budgeted: sortCategorySnapshotsForManagement(budgeted),
    noLimit: sortCategorySnapshotsForManagement(noLimit),
  };
}

export function filterCategorySnapshots(
  snapshots: CategoryBudgetSnapshot[],
  filter: CategoryBudgetFilter,
): CategoryBudgetSnapshot[] {
  if (filter === "all") return snapshots;
  return snapshots.filter((snap) => {
    const status = getCategoryManagementStatus(snap);
    if (filter === "over") return status === "over";
    if (filter === "near") return status === "near";
    if (filter === "no_limit") return status === "no_limit";
    return true;
  });
}

export function getCategoryFilterCounts(snapshots: CategoryBudgetSnapshot[]): Record<
  CategoryBudgetFilter,
  number
> {
  let over = 0;
  let near = 0;
  let noLimit = 0;

  for (const snap of snapshots) {
    const status = getCategoryManagementStatus(snap);
    if (status === "over") over += 1;
    else if (status === "near") near += 1;
    else if (status === "no_limit") noLimit += 1;
  }

  return {
    all: snapshots.length,
    over,
    near,
    no_limit: noLimit,
  };
}

export function getCategorySortRank(snap: CategoryBudgetSnapshot): number {
  if (snap.isOver) return 0;
  if (snap.limitCents > 0 && isCloseToLimit(snap.spentCents, snap.limitCents)) return 1;
  if (snap.limitCents <= 0) return 2;
  return 3;
}

export function sortCategorySnapshotsForManagement(
  snapshots: CategoryBudgetSnapshot[],
): CategoryBudgetSnapshot[] {
  return [...snapshots].sort((a, b) => {
    const rankDiff = getCategorySortRank(a) - getCategorySortRank(b);
    if (rankDiff !== 0) return rankDiff;
    if (b.spentCents !== a.spentCents) return b.spentCents - a.spentCents;
    return a.categoryLabel.localeCompare(b.categoryLabel);
  });
}

export function buildBudgetPlanningSummary({
  categories,
  expenses,
  categoryLimits,
  incomeCents = 0,
}: {
  categories: CategoryDef[];
  expenses: Expense[];
  categoryLimits: Record<string, number>;
  incomeCents?: number;
}): BudgetPlanningSummary {
  const spentByCategory = buildSpentByCategory(expenses);

  let assignedCents = 0;

  const categorySnapshots: CategoryBudgetSnapshot[] = categories.map((cat) => {
    const spentCents = spentByCategory[cat.value] || 0;
    const limitCents = categoryLimits[cat.value] ?? 0;
    const hasLimit = limitCents > 0;

    if (hasLimit) {
      assignedCents += limitCents;
    }

    const remainingCents = hasLimit ? limitCents - spentCents : 0;
    const isOver = hasLimit && spentCents > limitCents;
    const progressPct =
      hasLimit && limitCents > 0
        ? Math.min(100, Math.round((spentCents / limitCents) * 100))
        : 0;

    return {
      categoryValue: cat.value,
      categoryLabel: cat.label,
      iconKey: cat.iconKey,
      isCustom: cat.isCustom,
      limitCents,
      spentCents,
      remainingCents,
      isOver,
      progressPct,
    };
  });

  const unassignedCents = incomeCents - assignedCents;
  const isOverAssigned = incomeCents > 0 && assignedCents > incomeCents;
  const assignmentProgressPct =
    incomeCents > 0 ? Math.min(100, Math.round((assignedCents / incomeCents) * 100)) : 0;

  return {
    incomeCents,
    assignedCents,
    unassignedCents,
    assignmentProgressPct,
    isOverAssigned,
    categorySnapshots: sortCategorySnapshotsForManagement(categorySnapshots),
  };
}
